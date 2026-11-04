import { supabase } from './supabase';
import type {
  PrestadorPerfilPro,
  PrestadorPerfilPublico,
  PrestadorUltimoPedido,
  PrestadorPessoaJuridica,
  PrestadorDocumento,
  PrestadorPortfolioItem,
  PrestadorDisponibilidade,
  PrestadorAvaliacao,
  PrestadorFinanceiroRegistro,
  PrestadorSaqueSolicitacao,
  SolfcoinTransacao,
  NivelRegra,
  TipoDocumentoPrestador,
} from '../types/condo';

// ─── 1. BUSCAR OU CRIAR PRESTADOR VINCULADO AO USUÁRIO LOGADO ────────────────
export async function obterOuCriarPrestadorLogado(): Promise<PrestadorPerfilPro | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Tenta buscar o prestador pelo user_id
  const { data, error } = await supabase
    .from('prestadores')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[PrestadorPainelAPI] Erro ao buscar prestador logado:', error);
  }

  let prestadorRow = data;

  if (!prestadorRow) {
    // Se não existir pelo user_id, verifica se existe algum pelo email ou cria novo
    const meta = user.user_metadata || {};
    const novo = {
      user_id: user.id,
      name: meta.full_name || meta.name || 'Prestador Solfy PRO',
      service_type: 'Manutenção Predial',
      phone: meta.phone || '',
      rating: 5.0,
      completed_requests: 0,
      categorias_atendidas: ['Eletricista Predial', 'Encanador & Bombas'],
      regioes_atendimento: ['Itu, SP', 'Salto, SP'],
      raio_atendimento_km: 30,
      nivel: 'bronze',
      solfcoins_saldo: 50, // Bônus de boas-vindas
      apto_servicos_grandes: false,
      status_cadastro: 'incompleto',
      foto_perfil_url: meta.avatar_url || null,
      foto_capa_url: null,
      bio_apresentacao: 'Especialista em manutenção preventiva e corretiva condominial.',
      total_servicos_concluidos: 0,
    };

    const { data: criado, error: errCriar } = await supabase
      .from('prestadores')
      .insert(novo)
      .select('*')
      .single();

    if (errCriar) {
      console.error('[PrestadorPainelAPI] Falha ao criar prestador:', errCriar);
      return null;
    }
    prestadorRow = criado;
  }

  // 1. Busca dados de pessoa jurídica vinculados
  let pjData: PrestadorPessoaJuridica | null = null;
  if (prestadorRow?.id) {
    const { data: pj } = await supabase
      .from('prestador_pessoa_juridica')
      .select('*')
      .eq('prestador_id', prestadorRow.id)
      .maybeSingle();
    pjData = pj;
  }

  // 2. Busca caso KYC mais recente para extrair nome fantasia e documento declarado
  let kycNomeFantasia: string | null = null;
  let kycDocNumero: string | null = null;
  try {
    const { data: kycCaso } = await supabase
      .from('kyc_casos')
      .select('dados, dados_submetidos')
      .eq('usuario_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (kycCaso) {
      const d = kycCaso.dados || {};
      const etapa = d.etapa_7 || d.etapa_6 || d.etapa_5 || d.etapa_4 || {};
      const sub = kycCaso.dados_submetidos || {};
      kycNomeFantasia = etapa.nomeFantasia || etapa.razaoSocial || sub.nome_fantasia || sub.razao_ou_nome || d.nomeFantasia || null;
      kycDocNumero = etapa.documentoNumero || sub.documento || d.documentoNumero || null;
    }
  } catch (errKyc) {
    console.warn('[PrestadorPainelAPI] Aviso ao buscar dados declarados do KYC:', errKyc);
  }

  const nomeFantasiaFinal = pjData?.razao_social || kycNomeFantasia || prestadorRow.name;
  const docFiscalFinal = pjData?.cnpj || pjData?.cpf || kycDocNumero || null;

  // 3. Se o nome no banco ainda for genérico ('Prestador', 'Prestador Profissional', etc.) e tivermos o nome real
  if (
    nomeFantasiaFinal &&
    (!prestadorRow.name || ['Prestador', 'Prestador Profissional', 'Prestador Solfy PRO'].includes(prestadorRow.name))
  ) {
    await supabase
      .from('prestadores')
      .update({ name: nomeFantasiaFinal })
      .eq('id', prestadorRow.id);
    prestadorRow.name = nomeFantasiaFinal;
  }

  // 4. Se a PJ ainda não existir no banco mas tivermos o documento e nome, sincroniza em prestador_pessoa_juridica
  if (!pjData && docFiscalFinal && prestadorRow.id) {
    const limpo = docFiscalFinal.replace(/\D/g, '');
    const isCnpj = limpo.length > 11;
    const { data: novaPj } = await supabase
      .from('prestador_pessoa_juridica')
      .insert({
        prestador_id: prestadorRow.id,
        tipo_pessoa: isCnpj ? 'juridica' : 'fisica',
        cnpj: isCnpj ? docFiscalFinal : null,
        cpf: !isCnpj ? docFiscalFinal : null,
        razao_social: nomeFantasiaFinal,
        possui_mei: true,
      })
      .select('*')
      .maybeSingle();
    if (novaPj) pjData = novaPj;
  }

  const normalizado = normalizarPrestador(prestadorRow);
  return {
    ...normalizado,
    name: nomeFantasiaFinal || normalizado.name,
    nome_fantasia: nomeFantasiaFinal || normalizado.name,
    documento_fiscal: docFiscalFinal,
    cnpj: pjData?.cnpj || (docFiscalFinal && docFiscalFinal.replace(/\D/g, '').length > 11 ? docFiscalFinal : null),
    cpf: pjData?.cpf || (docFiscalFinal && docFiscalFinal.replace(/\D/g, '').length <= 11 ? docFiscalFinal : null),
  };
}

function normalizarPrestador(raw: any): PrestadorPerfilPro {
  return {
    id: raw.id,
    user_id: raw.user_id,
    name: raw.name || 'Prestador Profissional',
    service_type: raw.service_type || 'Técnico Especialista',
    phone: raw.phone || '',
    rating: Number(raw.rating || 5.0),
    completed_requests: Number(raw.completed_requests || 0),
    created_at: raw.created_at,
    categorias_atendidas: Array.isArray(raw.categorias_atendidas) ? raw.categorias_atendidas : [],
    regioes_atendimento: Array.isArray(raw.regioes_atendimento) ? raw.regioes_atendimento : [],
    raio_atendimento_km: Number(raw.raio_atendimento_km || 25),
    nivel: raw.nivel || 'bronze',
    solfcoins_saldo: Number(raw.solfcoins_saldo || 0),
    apto_servicos_grandes: Boolean(raw.apto_servicos_grandes),
    status_cadastro: raw.status_cadastro || 'incompleto',
    foto_perfil_url: raw.foto_perfil_url || null,
    foto_capa_url: raw.foto_capa_url || null,
    bio_apresentacao: raw.bio_apresentacao || '',
    total_servicos_concluidos: Number(raw.total_servicos_concluidos ?? raw.completed_requests ?? 0),
  };
}

// ─── 2. ATUALIZAR PERFIL DO PRESTADOR ─────────────────────────────────────────
export async function atualizarPerfilPrestador(
  prestadorId: string,
  dados: Partial<PrestadorPerfilPro>
): Promise<void> {
  const updatePayload: Record<string, any> = {};
  if (dados.name !== undefined) updatePayload.name = dados.name;
  if (dados.service_type !== undefined) updatePayload.service_type = dados.service_type;
  if (dados.phone !== undefined) updatePayload.phone = dados.phone;
  if (dados.categorias_atendidas !== undefined) updatePayload.categorias_atendidas = dados.categorias_atendidas;
  if (dados.regioes_atendimento !== undefined) updatePayload.regioes_atendimento = dados.regioes_atendimento;
  if (dados.raio_atendimento_km !== undefined) updatePayload.raio_atendimento_km = dados.raio_atendimento_km;
  if (dados.bio_apresentacao !== undefined) updatePayload.bio_apresentacao = dados.bio_apresentacao?.slice(0, 160);
  if (dados.foto_perfil_url !== undefined) updatePayload.foto_perfil_url = dados.foto_perfil_url;
  if (dados.foto_capa_url !== undefined) updatePayload.foto_capa_url = dados.foto_capa_url;

  const { error } = await supabase
    .from('prestadores')
    .update(updatePayload)
    .eq('id', prestadorId);

  if (error) {
    console.error('[PrestadorPainelAPI] Erro ao atualizar perfil:', error);
    throw new Error(error.message);
  }
}

// ─── 3. DADOS DE PESSOA JURÍDICA / FISCAL ────────────────────────────────────
export async function obterDadosPessoaJuridica(prestadorId: string): Promise<PrestadorPessoaJuridica | null> {
  const { data, error } = await supabase
    .from('prestador_pessoa_juridica')
    .select('*')
    .eq('prestador_id', prestadorId)
    .maybeSingle();

  if (error) {
    console.error('[PrestadorPainelAPI] Erro ao obter PJ:', error);
    return null;
  }
  return data;
}

export async function salvarDadosPessoaJuridica(
  prestadorId: string,
  dados: Partial<PrestadorPessoaJuridica>
): Promise<void> {
  const { error } = await supabase
    .from('prestador_pessoa_juridica')
    .upsert({
      prestador_id: prestadorId,
      tipo_pessoa: dados.tipo_pessoa || 'fisica',
      cpf: dados.cpf || null,
      cnpj: dados.cnpj || null,
      razao_social: dados.razao_social || null,
      possui_mei: Boolean(dados.possui_mei),
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'prestador_id' });

  if (error) {
    console.error('[PrestadorPainelAPI] Erro ao salvar PJ:', error);
    throw new Error(error.message);
  }
}

// ─── 4. DOCUMENTOS (KYC GERAL E TÉCNICO) ──────────────────────────────────────
export async function listarDocumentosPrestador(prestadorId: string): Promise<PrestadorDocumento[]> {
  // 1. Busca documentos específicos da tabela prestador_documentos
  const { data: b2bDocs, error } = await supabase
    .from('prestador_documentos')
    .select('*')
    .eq('prestador_id', prestadorId)
    .order('enviado_em', { ascending: false });

  if (error) {
    console.error('[PrestadorPainelAPI] Erro ao listar docs prestador:', error);
  }

  const listaFinal: PrestadorDocumento[] = [...(b2bDocs || [])];

  // 2. Busca também os documentos do KYC original para não duplicar exigência do que já foi enviado
  try {
    const { data: prestador } = await supabase
      .from('prestadores')
      .select('user_id')
      .eq('id', prestadorId)
      .maybeSingle();

    if (prestador?.user_id) {
      const { data: caso } = await supabase
        .from('kyc_casos')
        .select('id, status')
        .eq('usuario_id', prestador.user_id)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (caso?.id) {
        const { data: kycDocs } = await supabase
          .from('kyc_documentos')
          .select('*')
          .eq('caso_id', caso.id);

        if (kycDocs && kycDocs.length > 0) {
          // Mapeia tipos do KYC para tipos do painel do prestador
          const mapaTipos: Record<string, TipoDocumentoPrestador> = {
            identidade_frente: 'rg_cpf',
            identidade_verso: 'rg_cpf',
            selfie: 'selfie_verificacao',
            comprovante_residencia: 'comprovante_endereco',
            cartao_cnpj: 'cnpj_cartao',
            apolice_seguro: 'seguro_responsabilidade_civil',
            comprovante_seguro: 'seguro_responsabilidade_civil',
            registro_profissional: 'certificado_tecnico',
            certificado_nr: 'certificado_tecnico',
            antecedentes_criminais: 'antecedentes_criminais',
          };

          for (const kd of kycDocs) {
            const tipoEquivalente = mapaTipos[kd.tipo];
            if (!tipoEquivalente) continue;

            // Se já existe um documento B2B mais específico enviado para esse tipo, mantém o B2B
            const jaExiste = listaFinal.some((d) => d.tipo_documento === tipoEquivalente);
            if (!jaExiste) {
              const url = kd.storage_path?.startsWith('http')
                ? kd.storage_path
                : supabase.storage.from('kyc-documentos-privados').getPublicUrl(kd.storage_path).data.publicUrl;

              const statusTraduzido = kd.status === 'correcao_pedida'
                ? 'rejeitado'
                : (caso.status === 'aprovado' || kd.status === 'aceito')
                ? 'aprovado'
                : 'em_analise';

              listaFinal.push({
                id: kd.id,
                prestador_id: prestadorId,
                tipo_documento: tipoEquivalente,
                arquivo_url: url,
                status: statusTraduzido,
                motivo_rejeicao: kd.status === 'correcao_pedida' ? 'Correção solicitada na mesa de conferência' : null,
                analisado_por: null,
                enviado_em: kd.enviado_em || new Date().toISOString(),
                atualizado_em: kd.enviado_em || new Date().toISOString(),
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[PrestadorPainelAPI] Falha ao unificar documentos do KYC:', err);
  }

  return listaFinal;
}

export async function uploadDocumentoPrestador(
  prestadorId: string,
  tipo: TipoDocumentoPrestador,
  file: File
): Promise<PrestadorDocumento> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || prestadorId;
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${userId}/${tipo}_${Date.now()}.${ext}`;

  // 1. Upload Storage
  const { error: uploadError } = await supabase.storage
    .from('prestador-documentos')
    .upload(path, file, { upsert: true });

  if (uploadError) {
    console.error('[PrestadorPainelAPI] Erro no upload:', uploadError);
    throw new Error('Falha no upload do arquivo: ' + uploadError.message);
  }

  const { data: publicData } = supabase.storage
    .from('prestador-documentos')
    .getPublicUrl(path);

  const arquivoUrl = publicData.publicUrl;

  // 2. Grava ou atualiza na tabela
  const { data, error } = await supabase
    .from('prestador_documentos')
    .insert({
      prestador_id: prestadorId,
      tipo_documento: tipo,
      arquivo_url: arquivoUrl,
      status: 'em_analise',
    })
    .select('*')
    .single();

  if (error) {
    console.error('[PrestadorPainelAPI] Erro ao salvar doc:', error);
    throw new Error(error.message);
  }

  // Atualiza status_cadastro para 'em_analise' caso estivesse 'incompleto'
  await supabase
    .from('prestadores')
    .update({ status_cadastro: 'em_analise' })
    .eq('id', prestadorId)
    .eq('status_cadastro', 'incompleto');

  return data;
}

// ─── 5. PORTFÓLIO DE TRABALHOS ───────────────────────────────────────────────
export async function listarPortfolio(prestadorId: string): Promise<PrestadorPortfolioItem[]> {
  const { data, error } = await supabase
    .from('prestador_portfolio')
    .select(`
      *,
      solicitacao:solicitacoes (
        titulo
      )
    `)
    .eq('prestador_id', prestadorId)
    .order('ordem_exibicao', { ascending: true });

  if (error) {
    // Fallback simples caso join falhe
    const { data: fallback } = await supabase
      .from('prestador_portfolio')
      .select('*')
      .eq('prestador_id', prestadorId)
      .order('ordem_exibicao', { ascending: true });
    return (fallback || []).map((item: any) => ({
      ...item,
      solicitacao_titulo: null,
    }));
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    prestador_id: item.prestador_id,
    foto_url: item.foto_url,
    titulo: item.titulo,
    descricao: item.descricao,
    categoria_relacionada: item.categoria_relacionada,
    solicitacao_id: item.solicitacao_id || null,
    solicitacao_titulo: item.solicitacao?.titulo || null,
    ordem_exibicao: item.ordem_exibicao || 0,
    criado_em: item.criado_em,
  }));
}

export async function adicionarItemPortfolio(
  prestadorId: string,
  file: File,
  titulo?: string,
  descricao?: string,
  categoria?: string,
  solicitacaoId?: string
): Promise<PrestadorPortfolioItem> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${prestadorId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('prestador-portfolio')
    .upload(path, file, { upsert: true });

  if (uploadError) {
    console.warn('[PrestadorPainelAPI] Falha no upload Storage, usando DataURL fallback:', uploadError);
  }

  let fotoUrl = '';
  if (!uploadError) {
    const { data: publicData } = supabase.storage.from('prestador-portfolio').getPublicUrl(path);
    fotoUrl = publicData.publicUrl;
  } else {
    fotoUrl = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(file);
    });
  }

  const { data, error } = await supabase
    .from('prestador_portfolio')
    .insert({
      prestador_id: prestadorId,
      foto_url: fotoUrl,
      titulo: titulo || null,
      descricao: descricao || null,
      categoria_relacionada: categoria || null,
      solicitacao_id: solicitacaoId || null,
      ordem_exibicao: 0,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removerItemPortfolio(itemId: string): Promise<void> {
  await supabase.from('prestador_portfolio').delete().eq('id', itemId);
}

// ─── 6. DISPONIBILIDADE SEMANAL ──────────────────────────────────────────────
export async function listarDisponibilidade(prestadorId: string): Promise<PrestadorDisponibilidade[]> {
  const { data, error } = await supabase
    .from('prestador_disponibilidade')
    .select('*')
    .eq('prestador_id', prestadorId)
    .order('dia_semana', { ascending: true });

  if (error) {
    console.error('[PrestadorPainelAPI] Erro ao listar disponibilidade:', error);
    return [];
  }
  return data || [];
}

export async function salvarDisponibilidade(
  prestadorId: string,
  itens: { dia_semana: number; horario_inicio: string; horario_fim: string; ativo: boolean }[]
): Promise<void> {
  // Limpa anteriores e insere novos
  await supabase.from('prestador_disponibilidade').delete().eq('prestador_id', prestadorId);

  if (itens.length > 0) {
    const records = itens.map((it) => ({
      prestador_id: prestadorId,
      dia_semana: it.dia_semana,
      horario_inicio: it.horario_inicio,
      horario_fim: it.horario_fim,
      ativo: it.ativo,
    }));

    const { error } = await supabase.from('prestador_disponibilidade').insert(records);
    if (error) throw new Error(error.message);
  }
}

// ─── 7. MINHAS COTAÇÕES ENVIADAS ─────────────────────────────────────────────
export async function listarMinhasCotacoes(prestadorId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('cotacoes')
    .select(`
      id,
      solicitacao_id,
      valor,
      prazo_execucao_dias,
      observacoes,
      selecionada,
      criado_em,
      opcoes_visita_tecnica,
      solicitacao:solicitacoes (
        id,
        titulo,
        categoria,
        descricao,
        urgencia,
        status,
        cancelamento_motivo,
        cancelado_em,
        condominio:condominios (
          nome,
          endereco
        )
      )
    `)
    .eq('prestador_id', prestadorId)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('[PrestadorPainelAPI] Erro ao listar cotações:', error);
    return [];
  }
  return data || [];
}

// ─── 8. AGENDA DE SERVIÇOS ACEITOS / EM EXECUÇÃO ─────────────────────────────
export async function listarAgendaServicos(prestadorId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('cotacoes')
    .select(`
      id,
      solicitacao_id,
      valor,
      prazo_execucao_dias,
      selecionada,
      solicitacao:solicitacoes (
        id,
        titulo,
        categoria,
        descricao,
        status,
        cancelamento_motivo,
        cancelado_em,
        urgencia,
        prazo_desejado,
        janela_horario_preferida,
        forma_pagamento_prevista,
        atualizado_em,
        condominio:condominios (
          nome,
          endereco
        )
      )
    `)
    .eq('prestador_id', prestadorId)
    .eq('selecionada', true)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('[PrestadorPainelAPI] Erro ao buscar agenda:', error);
    return [];
  }
  return data || [];
}

// ─── 9. FINANCEIRO & EXTRATO ─────────────────────────────────────────────────
export async function obterExtratoFinanceiro(prestadorId: string): Promise<{
  registros: PrestadorFinanceiroRegistro[];
  saldoDisponivel: number;
  saldoPendente: number;
  totalGanho: number;
}> {
  const { data, error } = await supabase
    .from('prestador_financeiro')
    .select(`
      id,
      prestador_id,
      solicitacao_id,
      valor_bruto,
      comissao_solfy_percentual,
      comissao_solfy_valor,
      valor_liquido,
      status_pagamento,
      pago_em,
      criado_em,
      solicitacao:solicitacoes (
        titulo
      )
    `)
    .eq('prestador_id', prestadorId)
    .order('criado_em', { ascending: false });

  if (error || !data) {
    return { registros: [], saldoDisponivel: 0, saldoPendente: 0, totalGanho: 0 };
  }

  const registros: PrestadorFinanceiroRegistro[] = data.map((r: any) => ({
    id: r.id,
    prestador_id: r.prestador_id,
    solicitacao_id: r.solicitacao_id,
    valor_bruto: Number(r.valor_bruto || 0),
    comissao_solfy_percentual: Number(r.comissao_solfy_percentual || 15),
    comissao_solfy_valor: Number(r.comissao_solfy_valor || 0),
    valor_liquido: Number(r.valor_liquido || 0),
    status_pagamento: r.status_pagamento,
    pago_em: r.pago_em,
    criado_em: r.criado_em,
    solicitacao_titulo: r.solicitacao?.titulo || 'Serviço Predial',
  }));

  let saldoDisponivel = 0;
  let saldoPendente = 0;
  let totalGanho = 0;

  registros.forEach((r) => {
    totalGanho += r.valor_liquido;
    if (r.status_pagamento === 'pago') {
      saldoDisponivel += r.valor_liquido;
    } else {
      saldoPendente += r.valor_liquido;
    }
  });

  return { registros, saldoDisponivel, saldoPendente, totalGanho };
}

// ─── 10. SAQUES ──────────────────────────────────────────────────────────────
export async function listarSaques(prestadorId: string): Promise<PrestadorSaqueSolicitacao[]> {
  const { data, error } = await supabase
    .from('prestador_saque_solicitacao')
    .select('*')
    .eq('prestador_id', prestadorId)
    .order('solicitado_em', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function solicitarSaque(
  prestadorId: string,
  valor: number,
  chavePix: string
): Promise<PrestadorSaqueSolicitacao> {
  const { data, error } = await supabase
    .from('prestador_saque_solicitacao')
    .insert({
      prestador_id: prestadorId,
      valor,
      chave_pix: chavePix,
      status: 'solicitado',
    })
    .select('*')
    .single();

  if (error) throw new Error('Erro ao solicitar saque: ' + error.message);
  return data;
}

// ─── 11. GAMIFICAÇÃO & SOLFCOINS ─────────────────────────────────────────────
export async function obterRegrasNiveis(): Promise<NivelRegra[]> {
  const { data, error } = await supabase
    .from('nivel_regras')
    .select('*')
    .order('servicos_minimos_concluidos', { ascending: true });

  if (error || !data) return [];
  return data as NivelRegra[];
}

export async function listarExtratoSolfcoins(prestadorId: string): Promise<SolfcoinTransacao[]> {
  const { data, error } = await supabase
    .from('solfcoins_transacoes')
    .select('*')
    .eq('prestador_id', prestadorId)
    .order('criado_em', { ascending: false });

  if (error) return [];
  return data || [];
}

// ─── 12. AVALIAÇÕES RECEBIDAS ────────────────────────────────────────────────
export async function listarAvaliacoesPrestador(prestadorId: string): Promise<PrestadorAvaliacao[]> {
  const { data, error } = await supabase
    .from('prestador_avaliacoes')
    .select(`
      id,
      prestador_id,
      solicitacao_id,
      avaliador_id,
      nota,
      comentario,
      criado_em
    `)
    .eq('prestador_id', prestadorId)
    .order('criado_em', { ascending: false });

  if (error) return [];
  return (data || []).map((a: any) => ({
    id: a.id,
    prestador_id: a.prestador_id,
    solicitacao_id: a.solicitacao_id,
    avaliador_id: a.avaliador_id,
    nota: a.nota,
    comentario: a.comentario,
    criado_em: a.criado_em,
    avaliador_nome: 'Síndico / Cliente',
  }));
}

// ─── 13. MÓDULO INSTAGRAM PROFILE (PROMPT 22 / REDESENHO) ────────────────────

export async function comprimirImagem(
  file: File,
  maxLargura: number,
  maxAltura: number,
  qualidade = 0.85
): Promise<File> {
  return new Promise((resolve) => {
    // Se não for imagem compatível com canvas, retorna original
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxLargura) {
          height = Math.round((height * maxLargura) / width);
          width = maxLargura;
        }
        if (height > maxAltura) {
          width = Math.round((width * maxAltura) / height);
          height = maxAltura;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            qualidade
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function uploadImagemPublicaPrestador(
  prestadorId: string,
  file: File,
  pasta: 'capas' | 'perfil' | 'portfolio'
): Promise<string> {
  let compressed = file;
  try {
    if (pasta === 'capas') {
      compressed = await comprimirImagem(file, 1200, 400, 0.85);
    } else if (pasta === 'perfil') {
      compressed = await comprimirImagem(file, 400, 400, 0.9);
    } else {
      compressed = await comprimirImagem(file, 1080, 1080, 0.85);
    }
  } catch (err) {
    console.warn('[PrestadorPainelAPI] Falha compressão canvas, usando imagem original:', err);
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${pasta}/${prestadorId}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('prestador-portfolio')
    .upload(path, compressed, { upsert: true });

  if (!uploadError) {
    const { data: publicData } = supabase.storage.from('prestador-portfolio').getPublicUrl(path);
    return publicData.publicUrl;
  }

  console.warn('[PrestadorPainelAPI] Storage indisponível, usando DataURL fallback:', uploadError);
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(compressed);
  });
}

export async function obterPerfilPublicoPrestador(prestadorId: string): Promise<PrestadorPerfilPublico | null> {
  // 1. Tenta consultar a view centralizada do Prompt 22
  const { data, error } = await supabase
    .from('prestador_perfil_publico')
    .select('*')
    .eq('id', prestadorId)
    .maybeSingle();

  if (!error && data) {
    return {
      id: data.id,
      name: data.name || 'Prestador Solfy',
      service_type: data.service_type || 'Técnico Especialista',
      phone: data.phone || null,
      foto_capa_url: data.foto_capa_url || null,
      foto_perfil_url: data.foto_perfil_url || null,
      bio_apresentacao: data.bio_apresentacao || null,
      nivel: data.nivel || 'bronze',
      categorias_atendidas: Array.isArray(data.categorias_atendidas) && data.categorias_atendidas.length > 0
        ? data.categorias_atendidas
        : [data.service_type || 'Geral'],
      regioes_atendimento: Array.isArray(data.regioes_atendimento) && data.regioes_atendimento.length > 0
        ? data.regioes_atendimento
        : ['Itu, SP', 'Salto, SP'],
      total_servicos_concluidos: Number(data.total_servicos_concluidos || 0),
      nota_media: Number(data.nota_media || 5.0),
      total_avaliacoes: Number(data.total_avaliacoes || 0),
    };
  }

  // 2. Fallback robusto sobre a tabela prestadores
  const { data: prestador, error: errP } = await supabase
    .from('prestadores')
    .select('*')
    .eq('id', prestadorId)
    .maybeSingle();

  if (errP || !prestador) return null;

  // Busca avaliações para calcular média real
  const { data: avs } = await supabase
    .from('prestador_avaliacoes')
    .select('nota')
    .eq('prestador_id', prestadorId);

  const totalAv = avs?.length || 0;
  const notaMed = totalAv > 0
    ? avs!.reduce((acc: number, curr: any) => acc + (Number(curr.nota) || 0), 0) / totalAv
    : Number(prestador.rating || 5.0);

  let fotoPerfil = prestador.foto_perfil_url || null;
  if (!fotoPerfil && prestador.user_id) {
    const { data: perf } = await supabase
      .from('perfis')
      .select('foto_url')
      .eq('user_id', prestador.user_id)
      .maybeSingle();
    if (perf?.foto_url) {
      fotoPerfil = perf.foto_url;
    }
  }

  return {
    id: prestador.id,
    name: prestador.name,
    service_type: prestador.service_type,
    phone: prestador.phone,
    foto_capa_url: prestador.foto_capa_url || null,
    foto_perfil_url: fotoPerfil,
    bio_apresentacao: prestador.bio_apresentacao || null,
    nivel: prestador.nivel || 'bronze',
    categorias_atendidas: Array.isArray(prestador.categorias_atendidas) && prestador.categorias_atendidas.length > 0
      ? prestador.categorias_atendidas
      : [prestador.service_type].filter(Boolean),
    regioes_atendimento: Array.isArray(prestador.regioes_atendimento) && prestador.regioes_atendimento.length > 0
      ? prestador.regioes_atendimento
      : ['Itu, SP', 'Salto, SP'],
    total_servicos_concluidos: Number(prestador.total_servicos_concluidos ?? prestador.completed_requests ?? 0),
    nota_media: Number(notaMed.toFixed(1)),
    total_avaliacoes: totalAv,
  };
}

export async function obterUltimosPedidosPrestador(prestadorId: string): Promise<PrestadorUltimoPedido[]> {
  // 1. Tenta consultar a view pública
  const { data, error } = await supabase
    .from('prestador_ultimos_pedidos')
    .select('*')
    .eq('prestador_id', prestadorId)
    .order('criado_em', { ascending: false })
    .limit(10);

  if (!error && data && data.length > 0) {
    return data.map((d: any) => ({
      solicitacao_id: d.solicitacao_id,
      prestador_id: d.prestador_id,
      titulo: d.titulo || 'Demanda Concluída',
      categoria: d.categoria,
      status: d.status,
      criado_em: d.criado_em,
      condominio_id: d.condominio_id,
      condominio_nome: d.condominio_nome || 'Condomínio Solfy',
      valor: Number(d.valor || 0),
      nota: d.nota ? Number(d.nota) : null,
    }));
  }

  // 2. Fallback via query direta em cotacoes selecionadas
  const { data: cotacoes, error: errCot } = await supabase
    .from('cotacoes')
    .select(`
      id,
      solicitacao_id,
      valor,
      selecionada,
      criado_em,
      solicitacao:solicitacoes (
        id,
        titulo,
        categoria,
        status,
        criado_em,
        condominio_id,
        condominio:condominios (
          nome
        )
      )
    `)
    .eq('prestador_id', prestadorId)
    .eq('selecionada', true)
    .order('criado_em', { ascending: false })
    .limit(10);

  if (errCot || !cotacoes) return [];

  return cotacoes
    .filter((c: any) => c.solicitacao)
    .map((c: any) => ({
      solicitacao_id: c.solicitacao.id,
      prestador_id: prestadorId,
      titulo: c.solicitacao.titulo || 'Manutenção Predial',
      categoria: c.solicitacao.categoria,
      status: c.solicitacao.status,
      criado_em: c.criado_em,
      condominio_id: c.solicitacao.condominio_id,
      condominio_nome: c.solicitacao.condominio?.nome || 'Condomínio Solfy',
      valor: Number(c.valor || 0),
      nota: null,
    }));
}

export async function listarServicosConcluidosPrestador(
  prestadorId: string
): Promise<{ id: string; titulo: string; categoria: string }[]> {
  const { data } = await supabase
    .from('cotacoes')
    .select(`
      solicitacao:solicitacoes (
        id,
        titulo,
        categoria,
        status
      )
    `)
    .eq('prestador_id', prestadorId)
    .eq('selecionada', true);

  if (!data) return [];
  return data
    .filter((d: any) => d.solicitacao && (d.solicitacao.status === 'concluida' || d.solicitacao.status === 'em_execucao'))
    .map((d: any) => ({
      id: d.solicitacao.id,
      titulo: d.solicitacao.titulo || 'Serviço Concluído',
      categoria: d.solicitacao.categoria,
    }));
}

// ─── 13. TERMO DE ACEITE DIGITAL CNPJ GRANDE ──────────────────────────────────
export const TEXTO_TERMO_CNPJ_GRANDE_V1 = `
TERMO DE ADESÃO E ACEITE DIGITAL PARA ATENDIMENTO A DEMANDAS DE GRANDE PORTE — SOLFY PRO

1. OBJETO E APLICABILIDADE
O presente Termo estabelece as condições comerciais e operacionais vinculantes para prestadores de serviços constituídos sob a forma de Pessoa Jurídica (exceto MEI sem capacidade operacional declarada) habilitados na Plataforma Solfy PRO para recebimento e execução de demandas corporativas e prediais de grande porte.

2. REMUNERAÇÃO E COMISSÃO DE SUCESSO SOLFY
2.1. O Prestador reconhece e anui expressamente que a remuneração devida à Solfy Tecnologia e Intermediação Ltda. corresponde à taxa percentual incidente sobre o valor global contratado pelo Condomínio.
2.2. A comissão da Solfy é devida e exigível imediatamente após a formalização ou conclusão do serviço/etapa pactuada, com vencimento ordinário indicado na Ordem de Pagamento (OP) emitida no painel financeiro.

3. CONSEQUÊNCIAS DO INADIMPLEMENTO
3.1. O não pagamento da comissão Solfy no prazo de vencimento ensejará:
    a) Bloqueio cautelar imediato do envio e recebimento de novas oportunidades e chamados;
    b) Incidência de multa moratória de 2% (dois por cento) e juros legais de 1% ao mês pro rata die;
    c) Notificação formal com prazo improrrogável de 48 (quarenta e oito) horas para regularização;
    d) Notificação direta ao Condomínio contratante informando a irregularidade cadastral e administrativa do fornecedor na intermediação, ensejando a remoção do credenciamento e mediação da execução;
    e) Emissão de título executivo e cobrança judicial/extrajudicial com inclusão nos órgãos de proteção ao crédito (SPC/Serasa) e protesto em cartório.

4. REGISTRO E VALIDADE JURÍDICA
O aceite deste Termo é realizado de forma eletrônica irrevogável, com registro em banco de dados da versão, carimbo de data/hora (timestamp UTC), identificador unívoco do usuário e metadados do aparelho/endereço IP, com plena eficácia probatória nos termos da legislação brasileira vigente.
`.trim();

export async function registrarAceiteTermoCnpjGrande(
  versao = 'v1.0',
  texto = TEXTO_TERMO_CNPJ_GRANDE_V1,
  aparelho?: string,
  ip?: string
): Promise<{ sucesso: boolean; registro_id?: string; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('registrar_aceite_termo_cnpj_grande', {
      p_versao: versao,
      p_texto: texto,
      p_aparelho: aparelho || null,
      p_ip: ip || null,
    });
    if (error) {
      console.error('[condoPrestadorPainelApi] Erro ao registrar termo:', error);
      return { sucesso: false, erro: error.message };
    }
    return { sucesso: true, registro_id: data?.registro_id };
  } catch (err: any) {
    return { sucesso: false, erro: err.message };
  }
}

export async function verificarAceiteTermoCnpjGrande(): Promise<{ aceito: boolean; termo?: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { aceito: false };

    const { data, error } = await supabase
      .from('prestador_termos_aceite')
      .select('*')
      .eq('user_id', user.id)
      .eq('tipo_porte', 'cnpj_grande')
      .order('aceito_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { aceito: false };
    }
    return { aceito: true, termo: data };
  } catch {
    return { aceito: false };
  }
}

// ─── 14. INADIMPLÊNCIA E BLOQUEIO DE COMISSÃO ──────────────────────────────────
export async function verificarInadimplenciaComissaoPrestador(prestadorId?: string): Promise<{
  inadimplente: boolean;
  totalEmAtraso: number;
  opsAtrasadas: any[];
}> {
  try {
    let pId = prestadorId;
    if (!pId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { inadimplente: false, totalEmAtraso: 0, opsAtrasadas: [] };
      const { data: p } = await supabase
        .from('prestadores')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!p) return { inadimplente: false, totalEmAtraso: 0, opsAtrasadas: [] };
      pId = p.id;
    }

    const { data: ops, error } = await supabase
      .from('ordens_pagamento_comissao')
      .select(`
        id,
        numero_op,
        valor_base_contrato,
        valor_comissao,
        data_vencimento,
        status,
        chave_pix,
        codigo_pix_copia_cola,
        solicitacao_id
      `)
      .eq('prestador_id', pId);

    if (error || !ops) {
      return { inadimplente: false, totalEmAtraso: 0, opsAtrasadas: [] };
    }

    const hoje = new Date().toISOString().split('T')[0];
    const atrasadas = ops.filter(
      (o: any) =>
        o.status === 'em_atraso' ||
        o.status === 'cobranca_juridica' ||
        (o.status === 'pendente' && o.data_vencimento && o.data_vencimento < hoje)
    );

    const total = atrasadas.reduce((acc: number, curr: any) => acc + Number(curr.valor_comissao || 0), 0);

    return {
      inadimplente: atrasadas.length > 0,
      totalEmAtraso: total,
      opsAtrasadas: atrasadas,
    };
  } catch (err) {
    console.warn('[condoPrestadorPainelApi] Erro ao verificar inadimplência:', err);
    return { inadimplente: false, totalEmAtraso: 0, opsAtrasadas: [] };
  }
}

// ─── 14. GESTÃO DE SESSÕES E SEGURANÇA DO PRESTADOR ─────────────────────────

export interface SessaoPrestadorItem {
  id: string;
  user_id: string;
  dispositivo_info: string;
  dispositivo: 'mobile' | 'desktop';
  navegador: string;
  sistema_operacional: string;
  ip: string;
  ip_aproximado?: string;
  localizacao_aproximada?: string;
  criado_em: string;
  ultima_atividade: string;
  atual: boolean;
}

export async function listarSessoesAtivasPrestador(userId: string): Promise<SessaoPrestadorItem[]> {
  try {
    const { data, error } = await supabase
      .from('sessoes_ativas')
      .select('*')
      .eq('user_id', userId)
      .eq('revogada', false)
      .order('ultima_atividade', { ascending: false });

    if (error || !data || data.length === 0) {
      return [
        {
          id: 'sessao-atual-pro',
          user_id: userId,
          dispositivo_info: 'Dispositivo Atual • App Solfy PRO',
          dispositivo: 'mobile',
          navegador: 'App Solfy PRO',
          sistema_operacional: 'Mobile OS',
          ip: 'Conexão Atual',
          ip_aproximado: 'Conexão Atual',
          localizacao_aproximada: 'Brasil',
          criado_em: new Date().toISOString(),
          ultima_atividade: new Date().toISOString(),
          atual: true,
        },
      ];
    }

    return data.map((s, idx) => ({ ...s, atual: idx === 0 }));
  } catch (err) {
    return [
      {
        id: 'sessao-atual-pro',
        user_id: userId,
        dispositivo_info: 'Dispositivo Atual • App Solfy PRO',
        dispositivo: 'mobile',
        navegador: 'App Solfy PRO',
        sistema_operacional: 'Mobile OS',
        ip: 'Conexão Atual',
        ip_aproximado: 'Conexão Atual',
        localizacao_aproximada: 'Brasil',
        criado_em: new Date().toISOString(),
        ultima_atividade: new Date().toISOString(),
        atual: true,
      },
    ];
  }
}

export async function encerrarSessaoRemotaPrestador(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessoes_ativas')
    .update({ revogada: true })
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Erro ao encerrar sessão: ${error.message}`);
  }
}

export async function encerrarTodasOutrasSessoesPrestador(userId: string): Promise<void> {
  const { data } = await supabase
    .from('sessoes_ativas')
    .select('id')
    .eq('user_id', userId)
    .eq('revogada', false)
    .order('ultima_atividade', { ascending: false });

  if (data && data.length > 1) {
    const idsParaRevogar = data.slice(1).map((s) => s.id);
    await supabase
      .from('sessoes_ativas')
      .update({ revogada: true })
      .in('id', idsParaRevogar);
  }
}

export async function solicitarTrocaEmail(novoEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() });
  if (error) throw new Error(error.message);
}

export async function solicitarTrocaTelefoneSms(novoTelefoneBruto: string): Promise<void> {
  const digitos = novoTelefoneBruto.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 11) {
    throw new Error('Informe um telefone brasileiro válido com DDD (10 ou 11 dígitos).');
  }
  const e164 = `+55${digitos}`;
  const { error } = await supabase.auth.updateUser({ phone: e164 });
  if (error) throw new Error(error.message);
}

export async function confirmarTrocaTelefoneSms(
  novoTelefoneBruto: string,
  codigoOtp: string,
  userId: string,
  prestadorId?: string
): Promise<void> {
  const digitos = novoTelefoneBruto.replace(/\D/g, '');
  const e164 = `+55${digitos}`;
  const { error } = await supabase.auth.verifyOtp({
    phone: e164,
    token: codigoOtp.trim(),
    type: 'phone_change',
  });
  if (error) throw new Error(error.message || 'Código SMS inválido ou expirado.');

  // Formata padrão (DD) 9XXXX-XXXX
  const telFormatado = digitos.length === 11
    ? `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
    : `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;

  // Atualiza perfil e prestador
  await supabase.from('perfis').update({ telefone: telFormatado, telefone_verificado: true }).eq('user_id', userId);
  if (prestadorId) {
    await supabase.from('prestadores').update({ phone: telFormatado }).eq('id', prestadorId);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// BLOCO 2: ESPECIALIDADES, RAIO, DISPONIBILIDADE & FATURAS REAIS
// ════════════════════════════════════════════════════════════════════════════

export interface SolicitacaoCategoriaItem {
  id: string;
  prestador_id: string;
  categoria_chave: string;
  categoria_nome?: string;
  status: 'em_analise' | 'aprovada' | 'recusada';
  motivo_solicitacao?: string;
  motivo_recusa?: string;
  solicitado_em: string;
  analisado_em?: string;
}

export interface CategoriaCatalogoItem {
  id: string;
  chave: string;
  label: string;
  icone?: string;
}

/**
 * Busca o catálogo oficial de especialidades/categorias ativas da plataforma.
 */
export async function listarCategoriasCatalogo(): Promise<CategoriaCatalogoItem[]> {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, chave, label, icone')
      .eq('ativa', true)
      .order('ordem_exibicao', { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) return data;
  } catch (_) {}

  // Fallback para categorias_servico
  try {
    const { data: servCats } = await supabase
      .from('categorias_servico')
      .select('id, nome')
      .eq('ativo', true);

    if (servCats && servCats.length > 0) {
      return servCats.map((c) => ({
        id: c.id,
        chave: c.id.toUpperCase(),
        label: c.nome,
        icone: 'Wrench',
      }));
    }
  } catch (_) {}

  return [
    { id: '1', chave: 'ELETRICISTA', label: 'Eletricista Predial', icone: 'Zap' },
    { id: '2', chave: 'ENCANADOR', label: 'Encanador & Bombas', icone: 'Droplets' },
    { id: '3', chave: 'PINTOR', label: 'Pintura & Fachadas', icone: 'Paintbrush' },
    { id: '4', chave: 'PEDREIRO', label: 'Alvenaria & Reforma', icone: 'Hammer' },
    { id: '5', chave: 'IMPERMEABILIZACAO', label: 'Impermeabilização & Lajes', icone: 'Shield' },
    { id: '6', chave: 'SERRALHERIA', label: 'Serralheria & Portões', icone: 'Lock' },
    { id: '7', chave: 'CFTV_INTERFONIA', label: 'CFTV, Interfonia & Acesso', icone: 'Camera' },
  ];
}

/**
 * Busca as solicitações de homologação de especialidade do prestador.
 */
export async function listarMinhasSolicitacoesCategoria(prestadorId: string): Promise<SolicitacaoCategoriaItem[]> {
  const { data, error } = await supabase
    .from('prestador_solicitacoes_categoria')
    .select('*')
    .eq('prestador_id', prestadorId)
    .order('solicitado_em', { ascending: false });

  if (error) {
    console.warn('Erro ao carregar solicitacoes_categoria:', error.message);
    return [];
  }
  return (data || []) as SolicitacaoCategoriaItem[];
}

/**
 * Solicita homologação de nova categoria para o admin (status: em_analise).
 */
export async function solicitarHomologacaoCategoria(
  categoriaChave: string,
  motivo?: string
): Promise<{ sucesso: boolean; mensagem: string; solicitacao: any }> {
  const { data, error } = await supabase.rpc('solicitar_homologacao_categoria', {
    p_categoria_chave: categoriaChave,
    p_motivo: motivo || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Remove especialidade da grade de atendimento do prestador via RPC própria.
 */
export async function removerMinhaCategoria(
  categoriaChave: string
): Promise<{ sucesso: boolean; mensagem: string; categorias_atendidas: string[] }> {
  const { data, error } = await supabase.rpc('remover_minha_categoria', {
    p_categoria_chave: categoriaChave,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Atualiza o raio de atendimento do prestador com validação de limites (1 a 50 km).
 */
export async function atualizarMeuRaioAtendimento(raioKm: number): Promise<{ sucesso: boolean; raio_km: number }> {
  const { data, error } = await supabase.rpc('atualizar_meu_raio_atendimento', {
    p_raio_km: raioKm,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Atualiza os parâmetros de atendimento emergencial e plantão 24h.
 */
export async function atualizarPlantaoEmergencia(
  prestadorId: string,
  plantao24h: boolean,
  atendeEmergencia: boolean
): Promise<void> {
  const { error } = await supabase
    .from('prestadores')
    .update({
      plantao_24h: plantao24h,
      atende_emergencia: atendeEmergencia,
    })
    .eq('id', prestadorId);

  if (error) throw new Error(error.message);
}

/**
 * Consulta cobranças reais de comissão do prestador para exibição de badge e pendências.
 */
export async function obterResumoFaturasPrestador(prestadorId: string): Promise<{
  totalPendentes: number;
  totalVencidas: number;
  valorTotalCentavos: number;
}> {
  try {
    const { data, error } = await supabase
      .from('cobrancas_comissao')
      .select('id, status, valor_centavos, vencimento')
      .eq('prestador_id', prestadorId)
      .in('status', ['pendente', 'vencida', 'em_negociacao']);

    if (error || !data) return { totalPendentes: 0, totalVencidas: 0, valorTotalCentavos: 0 };

    const hoje = new Date().toISOString().split('T')[0];
    let totalPendentes = 0;
    let totalVencidas = 0;
    let valorTotal = 0;

    for (const c of data) {
      valorTotal += c.valor_centavos || 0;
      if (c.status === 'vencida' || (c.vencimento && c.vencimento < hoje)) {
        totalVencidas++;
      } else {
        totalPendentes++;
      }
    }

    return {
      totalPendentes,
      totalVencidas,
      valorTotalCentavos: valorTotal,
    };
  } catch (_) {
    return { totalPendentes: 0, totalVencidas: 0, valorTotalCentavos: 0 };
  }
}




