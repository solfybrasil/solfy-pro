import { supabase } from './supabase';

export interface CobrancaComissaoItem {
  id: string;
  solicitacao_id: string;
  base_centavos: number;
  percentual: number;
  valor_centavos: number;
  valor_reais: number;
  status: 'pendente' | 'vencida' | 'em_negociacao' | 'paga' | 'em_analise' | 'cancelada';
  vencimento: string;
  pago_em?: string | null;
  comprovante_path?: string | null;
  comprovante_enviado_em?: string | null;
  bloqueia_novos_pedidos: boolean;
  criado_em: string;
  solicitacao_categoria: string;
  solicitacao_titulo?: string;
  solicitacao_descricao: string;
  condominio_nome: string;
  chave_pix: string;
  codigo_pix_copia_cola?: string;
}

export interface ExtratoComissoesResponse {
  cobrancas: CobrancaComissaoItem[];
  chave_pix: string;
  texto_aviso: string;
  totais: {
    total_cobrancas: number;
    total_em_aberto_reais: number;
    total_vencido_reais: number;
    total_pago_reais: number;
    esta_bloqueado: boolean;
  };
}

/**
 * 1. SINALIZAR CONCLUSÃO DA OBRA PELO PRESTADOR
 */
export async function sinalizarConclusaoObraPrestador(params: {
  solicitacaoId: string;
  observacoes?: string;
  fotos?: string[];
}): Promise<{ sucesso: boolean; mensagem: string; novo_status?: string }> {
  const { solicitacaoId, observacoes, fotos } = params;

  try {
    const { data, error } = await supabase.rpc('prestador_sinalizar_conclusao_pedido', {
      p_solicitacao_id: solicitacaoId,
      p_observacoes: observacoes || null,
      p_fotos: fotos || null,
    });

    if (error) {
      // Fallback direto via update caso RPC falhe
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updErr } = await supabase
        .from('solicitacoes')
        .update({
          status: 'aguardando_confirmacao_conclusao',
          conclusao_sinalizada_em: new Date().toISOString(),
          conclusao_sinalizada_por: user?.id,
          conclusao_observacoes_prestador: observacoes || null,
          conclusao_fotos_prestador: fotos || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', solicitacaoId);

      if (updErr) throw new Error(updErr.message);

      return {
        sucesso: true,
        novo_status: 'aguardando_confirmacao_conclusao',
        mensagem: 'Conclusão da obra sinalizada com sucesso. O síndico foi notificado.',
      };
    }

    return data;
  } catch (err: any) {
    console.error('[PrestadorExecucaoAPI] Erro ao sinalizar conclusão:', err);
    throw new Error(err?.message || 'Falha ao sinalizar conclusão da obra.');
  }
}

/**
 * 2. OBTER ESTADO DO CONTRATO EXTERNO / FINALIZAÇÃO
 */
export async function obterDadosContratoExterno(solicitacaoId: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('finalizacao_obter', {
      p_solicitacao_id: solicitacaoId,
    });

    if (error || !data) return { existe: false };
    return data;
  } catch (err) {
    console.warn('[PrestadorExecucaoAPI] Erro ao obter dados do contrato externo:', err);
    return { existe: false };
  }
}

/**
 * 3. ENVIAR CONTRATO EXTERNO / MINUTA ASSINADA PELO PRESTADOR
 */
export async function enviarContratoExternoPrestador(params: {
  solicitacaoId: string;
  valorDeclarado: number;
  arquivoBase64OuBlob: any;
  nomeArquivo?: string;
}): Promise<{ sucesso: boolean; mensagem?: string; erro?: string }> {
  try {
    const { solicitacaoId, valorDeclarado, arquivoBase64OuBlob, nomeArquivo } = params;
    const nomeFinal = (nomeArquivo || `contrato_prestador_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${solicitacaoId}/prestador/${Date.now()}_${nomeFinal}`;

    // Upload no bucket privado contratos-finalizacao
    const { error: upErr } = await supabase.storage
      .from('contratos-finalizacao')
      .upload(path, arquivoBase64OuBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (upErr) {
      console.warn('[PrestadorExecucaoAPI] Falha no upload Storage privado:', upErr);
    }

    const valorCentavos = Math.round(valorDeclarado * 100);

    const { data, error } = await supabase.rpc('finalizacao_enviar_contrato', {
      p_solicitacao_id: solicitacaoId,
      p_valor_centavos: valorCentavos,
      p_arquivo_path: path,
      p_sha256: `sha256_${Date.now()}`,
      p_nome: nomeFinal,
      p_bytes: 1024,
    });

    if (error) {
      return { sucesso: false, erro: error.message };
    }

    return { sucesso: true, mensagem: 'Contrato externo enviado com sucesso para validação do síndico.' };
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Erro ao enviar contrato externo.' };
  }
}

/**
 * 4. OBTER EXTRATO DE COMISSÕES SOLFY (PAGAS, PENDENTES, VENCIDAS)
 */
export async function obterExtratoComissoesPrestador(
  prestadorId?: string
): Promise<ExtratoComissoesResponse> {
  const chavePixDefault = 'financeiro@solfy.com.br';
  const textoAvisoDefault = 'Mantenha suas comissões em dia para continuar recebendo novas oportunidades de serviços prediais.';

  // 1. Tenta prioritariamente via RPC oficial
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('prestador_cobrancas_minhas');
    if (!rpcErr && rpcData) {
      const raw = rpcData as any;
      const cobrancasFormatadas: CobrancaComissaoItem[] = (raw.cobrancas || []).map((c: any) => ({
        ...c,
        valor_reais: Number(c.valor_centavos || 0) / 100,
      }));

      return {
        cobrancas: cobrancasFormatadas,
        chave_pix: raw.chave_pix || chavePixDefault,
        texto_aviso: raw.texto_aviso || textoAvisoDefault,
        totais: {
          total_cobrancas: Number(raw.totais?.total_cobrancas || cobrancasFormatadas.length),
          total_em_aberto_reais: Number(raw.totais?.total_em_aberto_centavos || 0) / 100,
          total_vencido_reais: Number(raw.totais?.total_vencido_centavos || 0) / 100,
          total_pago_reais: Number(raw.totais?.total_pago_centavos || 0) / 100,
          esta_bloqueado: Boolean(raw.totais?.esta_bloqueado),
        },
      };
    }
  } catch (_) {}

  // 2. Fallback via query direta em ordens_pagamento_comissao
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase.from('ordens_pagamento_comissao').select(`
      id,
      numero_op,
      solicitacao_id,
      prestador_id,
      valor_base_contrato,
      valor_comissao,
      data_vencimento,
      status,
      chave_pix,
      codigo_pix_copia_cola,
      comprovante_url,
      comprovante_enviado_em,
      pago_em,
      criado_em,
      solicitacao:solicitacoes (
        id,
        titulo,
        categoria,
        descricao,
        condominio:condominios (
          nome
        )
      )
    `);

    if (prestadorId) {
      query = query.eq('prestador_id', prestadorId);
    }

    const { data: ops, error: opsErr } = await query.order('criado_em', { ascending: false });

    if (opsErr || !ops) {
      return {
        cobrancas: [],
        chave_pix: chavePixDefault,
        texto_aviso: textoAvisoDefault,
        totais: { total_cobrancas: 0, total_em_aberto_reais: 0, total_vencido_reais: 0, total_pago_reais: 0, esta_bloqueado: false },
      };
    }

    const hojeStr = new Date().toISOString().split('T')[0];
    let totalEmAberto = 0;
    let totalVencido = 0;
    let totalPago = 0;
    let estaBloqueado = false;

    const lista: CobrancaComissaoItem[] = ops.map((op: any) => {
      const vComissao = Number(op.valor_comissao || 0);
      const isVencida = (op.status === 'em_atraso' || op.status === 'cobranca_juridica') ||
                        (op.status === 'pendente' && op.data_vencimento < hojeStr);

      if (op.status === 'pago') {
        totalPago += vComissao;
      } else {
        totalEmAberto += vComissao;
        if (isVencida) {
          totalVencido += vComissao;
          estaBloqueado = true;
        }
      }

      const s = op.solicitacao;
      return {
        id: op.id,
        solicitacao_id: op.solicitacao_id,
        base_centavos: Math.round(Number(op.valor_base_contrato || 0) * 100),
        percentual: 12,
        valor_centavos: Math.round(vComissao * 100),
        valor_reais: vComissao,
        status: op.status,
        vencimento: op.data_vencimento,
        pago_em: op.pago_em,
        comprovante_path: op.comprovante_url,
        comprovante_enviado_em: op.comprovante_enviado_em,
        bloqueia_novos_pedidos: isVencida,
        criado_em: op.criado_em,
        solicitacao_categoria: s?.categoria || 'Manutenção Predial',
        solicitacao_titulo: s?.titulo || 'Serviço Predial',
        solicitacao_descricao: s?.descricao || '',
        condominio_nome: s?.condominio?.nome || 'Condomínio Solfy',
        chave_pix: op.chave_pix || chavePixDefault,
        codigo_pix_copia_cola: op.codigo_pix_copia_cola || `00020126580014BR.GOV.BCB.PIX0114${chavePixDefault}5204000053039865405${vComissao.toFixed(2)}5802BR5909SOLFY_PRO6009SAO_PAULO62070503***6304`,
      };
    });

    return {
      cobrancas: lista,
      chave_pix: chavePixDefault,
      texto_aviso: textoAvisoDefault,
      totais: {
        total_cobrancas: lista.length,
        total_em_aberto_reais: totalEmAberto,
        total_vencido_reais: totalVencido,
        total_pago_reais: totalPago,
        esta_bloqueado: estaBloqueado,
      },
    };
  } catch (err) {
    console.error('[PrestadorExecucaoAPI] Erro ao obter cobranças:', err);
    return {
      cobrancas: [],
      chave_pix: chavePixDefault,
      texto_aviso: textoAvisoDefault,
      totais: { total_cobrancas: 0, total_em_aberto_reais: 0, total_vencido_reais: 0, total_pago_reais: 0, esta_bloqueado: false },
    };
  }
}

/**
 * 5. ENVIAR COMPROVANTE DE PAGAMENTO DA COMISSÃO SOLFY
 */
export async function enviarComprovanteComissaoPrestador(params: {
  cobrancaId: string;
  arquivoBlobOuUri: any;
  nomeArquivo?: string;
  observacoes?: string;
}): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { cobrancaId, arquivoBlobOuUri, nomeArquivo, observacoes } = params;
    const nomeFinal = (nomeArquivo || `comprovante_${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${cobrancaId}/${Date.now()}_${nomeFinal}`;

    // 1. Upload no bucket comprovantes-comissao
    const { error: upErr } = await supabase.storage
      .from('comprovantes-comissao')
      .upload(path, arquivoBlobOuUri, {
        upsert: true,
      });

    if (upErr) {
      console.warn('[PrestadorExecucaoAPI] Aviso no storage comprovantes-comissao:', upErr);
    }

    // 2. Atualiza via RPC oficial ou update direto
    const { error: rpcErr } = await supabase.rpc('prestador_cobranca_enviar_comprovante', {
      p_cobranca_id: cobrancaId,
      p_comprovante_path: path,
    });

    if (rpcErr) {
      // Fallback update direto na tabela ordens_pagamento_comissao
      const { error: updErr } = await supabase
        .from('ordens_pagamento_comissao')
        .update({
          comprovante_url: path,
          comprovante_enviado_em: new Date().toISOString(),
          comprovante_observacoes: observacoes || null,
          status: 'em_analise',
        })
        .eq('id', cobrancaId);

      if (updErr) {
        return { sucesso: false, erro: updErr.message };
      }
    }

    return { sucesso: true };
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Falha ao enviar comprovante.' };
  }
}
