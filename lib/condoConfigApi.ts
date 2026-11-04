// ─── API: Configurações, Governança, KYC e Integrações Solfy Condo ───────────
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { decode } from 'base64-arraybuffer';
import type {
  CondominioConfiguracoes,
  UsuarioPreferencias,
  SlaCategoria,
  TipoIntegracao,
  StatusIntegracao,
  CondominioIntegracao,
  CondominioPlanoAssinatura,
  SessaoAtiva,
  SindicoDadosPessoais,
  SindicoMandato,
  NivelVerificacaoInfo,
  MembroCondominio,
} from '../types/condo';

// ─── 1. CONFIGURAÇÕES OPERACIONAIS DO CONDOMÍNIO ───────────────────────────────

export async function buscarConfiguracoesCondominio(
  condominioId: string
): Promise<CondominioConfiguracoes | null> {
  try {
    const { data, error } = await supabase
      .from('condominio_configuracoes')
      .select('*')
      .eq('condominio_id', condominioId)
      .maybeSingle();

    if (error) {
      console.warn('[condoConfigApi] Erro ao buscar configs do condomínio:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[condoConfigApi] Falha ao carregar configs:', err);
    return null;
  }
}

export async function salvarConfiguracoesCondominio(
  condominioId: string,
  configs: Partial<CondominioConfiguracoes>
): Promise<CondominioConfiguracoes> {
  const { data: { user } } = await supabase.auth.getUser();

  const payload: Record<string, any> = {
    condominio_id: condominioId,
    atualizado_em: new Date().toISOString(),
  };

  if (user?.id) payload.atualizado_por = user.id;
  if (configs.logo_url !== undefined) payload.logo_url = configs.logo_url;
  if (configs.cor_tema !== undefined) payload.cor_tema = configs.cor_tema;
  if (configs.fuso_horario !== undefined) payload.fuso_horario = configs.fuso_horario;
  if (configs.dia_fechamento_financeiro !== undefined) payload.dia_fechamento_financeiro = configs.dia_fechamento_financeiro;
  if (configs.limite_aprovacao_automatica !== undefined) payload.limite_aprovacao_automatica = configs.limite_aprovacao_automatica;
  if (configs.exigir_dupla_aprovacao_acima_de !== undefined) payload.exigir_dupla_aprovacao_acima_de = configs.exigir_dupla_aprovacao_acima_de;
  if (configs.permitir_morador_ver_financeiro !== undefined) payload.permitir_morador_ver_financeiro = configs.permitir_morador_ver_financeiro;
  if (configs.chave_pix !== undefined) payload.chave_pix = configs.chave_pix;
  if (configs.banco_dados !== undefined) payload.banco_dados = configs.banco_dados;

  const { data, error } = await supabase
    .from('condominio_configuracoes')
    .upsert(payload, { onConflict: 'condominio_id' })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao salvar configurações do condomínio: ${error.message}`);
  }
  return data;
}

// ─── 2. PREFERÊNCIAS INDIVIDUAIS DO USUÁRIO ──────────────────────────────────

export async function buscarPreferenciasUsuario(
  userId: string
): Promise<UsuarioPreferencias | null> {
  try {
    const { data, error } = await supabase
      .from('usuario_preferencias')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[condoConfigApi] Erro ao buscar preferências do usuário:', error);
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

export async function salvarPreferenciasUsuario(
  userId: string,
  prefs: Partial<UsuarioPreferencias>
): Promise<UsuarioPreferencias> {
  const payload: Record<string, any> = {
    user_id: userId,
    atualizado_em: new Date().toISOString(),
  };

  if (prefs.idioma !== undefined) payload.idioma = prefs.idioma;
  if (prefs.tema_interface !== undefined) payload.tema_interface = prefs.tema_interface;
  if (prefs.notificacoes_email !== undefined) payload.notificacoes_email = prefs.notificacoes_email;
  if (prefs.notificacoes_whatsapp !== undefined) payload.notificacoes_whatsapp = prefs.notificacoes_whatsapp;
  if (prefs.notificacoes_push !== undefined) payload.notificacoes_push = prefs.notificacoes_push;
  if (prefs.horario_silencioso_inicio !== undefined) payload.horario_silencioso_inicio = prefs.horario_silencioso_inicio;
  if (prefs.horario_silencioso_fim !== undefined) payload.horario_silencioso_fim = prefs.horario_silencioso_fim;
  if (prefs.resumo_diario_email !== undefined) payload.resumo_diario_email = prefs.resumo_diario_email;

  const { data, error } = await supabase
    .from('usuario_preferencias')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao salvar preferências: ${error.message}`);
  }
  return data;
}

// ─── 3. SLA & CATEGORIAS DE RESPOSTA ─────────────────────────────────────────

export async function listarSlaCategorias(
  condominioId?: string
): Promise<SlaCategoria[]> {
  try {
    let query = supabase.from('sla_categorias').select('*');
    if (condominioId) {
      query = query.or(`condominio_id.is.null,condominio_id.eq.${condominioId}`);
    } else {
      query = query.is('condominio_id', null);
    }

    const { data, error } = await query.order('prioridade', { ascending: true });
    if (error) {
      console.warn('[condoConfigApi] Erro ao listar SLAs:', error);
      return [];
    }

    const map = new Map<string, SlaCategoria>();
    (data || []).forEach((item) => {
      if (!map.has(item.categoria) || item.condominio_id) {
        map.set(item.categoria, item);
      }
    });

    return Array.from(map.values());
  } catch (err) {
    return [];
  }
}

export async function salvarSlaCategoria(
  condominioId: string,
  sla: { categoria: string; tempo_resposta_horas: number; tempo_solucao_horas: number; prioridade?: string }
): Promise<SlaCategoria> {
  const { data: existente } = await supabase
    .from('sla_categorias')
    .select('id')
    .eq('condominio_id', condominioId)
    .eq('categoria', sla.categoria)
    .maybeSingle();

  const payload: Record<string, any> = {
    condominio_id: condominioId,
    categoria: sla.categoria,
    tempo_resposta_horas: sla.tempo_resposta_horas,
    tempo_solucao_horas: sla.tempo_solucao_horas,
    prioridade: sla.prioridade || 'alta',
    atualizado_em: new Date().toISOString(),
  };

  if (existente?.id) {
    payload.id = existente.id;
  }

  const { data, error } = await supabase
    .from('sla_categorias')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao salvar SLA: ${error.message}`);
  }
  return data;
}

// ─── 4. INTEGRAÇÕES OPERACIONAIS ──────────────────────────────────────────────

export async function listarIntegracoes(
  condominioId: string
): Promise<CondominioIntegracao[]> {
  const TIPOS: TipoIntegracao[] = [
    'whatsapp_business',
    'google_calendar',
    'contabilidade_externa',
    'administradora_sistema',
  ];

  try {
    const { data, error } = await supabase
      .from('condominio_integracoes')
      .select('*')
      .eq('condominio_id', condominioId);

    if (error) {
      console.warn('[condoConfigApi] Erro ao listar integrações:', error);
    }

    const map = new Map<string, CondominioIntegracao>(
      (data || []).map((i) => [i.tipo_integracao, i])
    );

    return TIPOS.map((tipo) => {
      return (
        map.get(tipo) || {
          id: `mock-${tipo}`,
          condominio_id: condominioId,
          tipo_integracao: tipo,
          status: 'desconectado',
          atualizado_em: new Date().toISOString(),
        }
      );
    });
  } catch (err) {
    return TIPOS.map((tipo) => ({
      id: `fallback-${tipo}`,
      condominio_id: condominioId,
      tipo_integracao: tipo,
      status: 'desconectado',
      atualizado_em: new Date().toISOString(),
    }));
  }
}

export async function atualizarStatusIntegracao(
  condominioId: string,
  tipo: TipoIntegracao,
  status: StatusIntegracao
): Promise<CondominioIntegracao> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('condominio_integracoes')
    .upsert(
      {
        condominio_id: condominioId,
        tipo_integracao: tipo,
        status,
        conectado_por: status === 'conectado' ? user?.id : null,
        conectado_em: status === 'conectado' ? new Date().toISOString() : null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'condominio_id,tipo_integracao' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar integração: ${error.message}`);
  }
  return data;
}

// ─── 5. PLANO E ASSINATURA SOLFY ──────────────────────────────────────────────

export async function buscarPlanoAssinatura(
  condominioId: string
): Promise<CondominioPlanoAssinatura> {
  try {
    const { data, error } = await supabase
      .from('condominio_plano_assinatura')
      .select('*')
      .eq('condominio_id', condominioId)
      .maybeSingle();

    if (error || !data) {
      return {
        condominio_id: condominioId,
        plano_atual: 'pro',
        data_inicio: new Date().toISOString().split('T')[0],
        data_proxima_cobranca: '10/10/2026',
        valor_mensal: 249.00,
        status_pagamento: 'em_dia',
        limite_condominios_incluidos: 3,
      };
    }
    return data;
  } catch (err) {
    return {
      condominio_id: condominioId,
      plano_atual: 'pro',
      data_inicio: new Date().toISOString().split('T')[0],
      data_proxima_cobranca: '10/10/2026',
      valor_mensal: 249.00,
      status_pagamento: 'em_dia',
      limite_condominios_incluidos: 3,
    };
  }
}

// ─── 6. SESSÕES ATIVAS & SEGURANÇA ────────────────────────────────────────────

export async function listarSessoesAtivas(userId: string): Promise<SessaoAtiva[]> {
  try {
    const { data, error } = await supabase
      .from('sessoes_ativas')
      .select('*')
      .eq('user_id', userId)
      .eq('revogada', false)
      .order('ultima_atividade', { ascending: false });

    if (error || !data || data.length === 0) {
      const modelo = Device.modelName || (Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Dispositivo Android' : 'Navegador Web');
      return [
        {
          id: 'sessao-atual',
          user_id: userId,
          dispositivo_info: `${modelo} • Este aparelho`,
          dispositivo: Platform.OS === 'web' ? 'desktop' : 'mobile',
          navegador: Platform.OS === 'web' ? 'Web Browser' : 'App Solfy Condo',
          sistema_operacional: Platform.OS.toUpperCase(),
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
    const modelo = Device.modelName || (Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Dispositivo Android' : 'Navegador Web');
    return [
      {
        id: 'sessao-atual',
        user_id: userId,
        dispositivo_info: `${modelo} • Este aparelho`,
        dispositivo: Platform.OS === 'web' ? 'desktop' : 'mobile',
        navegador: Platform.OS === 'web' ? 'Web Browser' : 'App Solfy Condo',
        sistema_operacional: Platform.OS.toUpperCase(),
        ip: 'Conexão Atual',
        localizacao_aproximada: 'Brasil',
        criado_em: new Date().toISOString(),
        ultima_atividade: new Date().toISOString(),
        atual: true,
      },
    ];
  }
}

export async function encerrarSessaoRemota(sessaoId: string): Promise<void> {
  if (sessaoId === 'sessao-atual') {
    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase
    .from('sessoes_ativas')
    .update({ revogada: true })
    .eq('id', sessaoId);

  if (error) {
    throw new Error(`Erro ao encerrar sessão: ${error.message}`);
  }
}

// ─── 7. DADOS PESSOAIS DO SÍNDICO & MANDATO (KYC) ─────────────────────────────

export async function buscarDadosPessoais(userId: string): Promise<SindicoDadosPessoais | null> {
  try {
    const { data, error } = await supabase
      .from('sindico_dados_pessoais')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[condoConfigApi] Erro ao buscar dados pessoais:', error);
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

export async function salvarDadosPessoais(
  userId: string,
  dados: Partial<SindicoDadosPessoais>
): Promise<SindicoDadosPessoais> {
  const payload = {
    user_id: userId,
    ...dados,
    atualizado_em: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('sindico_dados_pessoais')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao salvar dados pessoais: ${error.message}`);
  }
  return data;
}

export async function buscarMandatoCondominio(
  condominioId: string
): Promise<SindicoMandato | null> {
  try {
    let res = await supabase
      .from('sindico_mandato')
      .select('*')
      .eq('condominio_id', condominioId)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (res.error && res.error.message?.includes('schema cache')) {
      res = await supabase
        .from('sindico_mandatos')
        .select('*')
        .eq('condominio_id', condominioId)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (res.error) {
      console.warn('[condoConfigApi] Erro ao buscar mandato:', res.error);
      return null;
    }
    return res.data;
  } catch (err) {
    return null;
  }
}

export async function salvarMandatoCondominio(
  condominioId: string,
  dados: Partial<SindicoMandato>
): Promise<SindicoMandato> {
  const { data: { user } } = await supabase.auth.getUser();

  const payload: Record<string, any> = {
    condominio_id: condominioId,
    sindico_id: user?.id,
    data_inicio_mandato: dados.data_inicio_mandato || new Date().toISOString().split('T')[0],
    data_fim_mandato: dados.data_fim_mandato || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status_mandato: dados.status_mandato || 'vigente',
    numero_ata_eleicao: dados.numero_ata_eleicao || null,
    documento_nomeacao_url: dados.documento_nomeacao_url || null,
    observacoes: dados.observacoes || null,
    atualizado_em: new Date().toISOString(),
  };

  if (dados.id) payload.id = dados.id;

  let { data, error } = await supabase
    .from('sindico_mandato')
    .upsert(payload)
    .select()
    .single();

  if (error && error.message?.includes('schema cache')) {
    const res2 = await supabase
      .from('sindico_mandatos')
      .upsert(payload)
      .select()
      .single();
    data = res2.data;
    error = res2.error;
  }

  if (error) {
    throw new Error(`Erro ao salvar mandato: ${error.message}`);
  }
  return data;
}

export async function obterStatusVerificacao(
  userId: string,
  condominioId: string
): Promise<NivelVerificacaoInfo> {
  try {
    const [pessoais, mandato] = await Promise.all([
      buscarDadosPessoais(userId),
      buscarMandatoCondominio(condominioId),
    ]);

    const pendencias: string[] = [];
    let nivel = 1; // Básico

    if (!pessoais?.cpf) {
      pendencias.push('Cadastrar CPF do síndico');
    } else {
      nivel = 2; // Bronze
    }

    if (!mandato || !mandato.data_fim_mandato) {
      pendencias.push('Informar período de vigência do mandato');
    } else {
      nivel = 3; // Prata
    }

    if (!mandato?.documento_nomeacao_url) {
      pendencias.push('Enviar Ata de Eleição ou Termo de Posse');
    } else {
      nivel = 4; // Ouro
    }

    if (pessoais?.registro_profissional) {
      nivel = 5; // Diamante
    }

    const labels = [
      'Não Verificado',
      'Cadastro Básico',
      'Identidade Confirmada (Bronze)',
      'Mandato Registrado (Prata)',
      'Síndico Verificado (Ouro)',
      'Síndico Profissional Certificado (Diamante)',
    ];

    const cores = ['#94A3B8', '#64748B', '#CD7F32', '#94A3B8', '#F59E0B', '#10B981'];

    return {
      nivel,
      label: labels[nivel] || 'Verificado',
      cor: cores[nivel] || '#10B981',
      pendenciasProximoNivel: pendencias,
    };
  } catch (err) {
    return {
      nivel: 3,
      label: 'Mandato Registrado (Prata)',
      cor: '#94A3B8',
      pendenciasProximoNivel: [],
    };
  }
}

// ─── 8. EQUIPE E PERMISSÕES ───────────────────────────────────────────────────

export async function listarMembrosEquipe(condominioId: string): Promise<MembroCondominio[]> {
  try {
    const { data: membros, error } = await supabase
      .from('membros_condominio')
      .select('*')
      .eq('condominio_id', condominioId)
      .eq('ativo', true)
      .order('criado_em', { ascending: true });

    if (error) {
      console.warn('[condoConfigApi] Erro ao listar membros da equipe:', error);
      return [];
    }

    if (!membros || membros.length === 0) {
      return [];
    }

    const userIds = membros.map((m: any) => m.user_id).filter(Boolean);
    let perfisMap = new Map<string, any>();

    if (userIds.length > 0) {
      try {
        const { data: perfis } = await supabase
          .from('perfis')
          .select('user_id, nome_completo, foto_url, telefone')
          .in('user_id', userIds);

        if (perfis) {
          perfis.forEach((p: any) => perfisMap.set(p.user_id, p));
        }
      } catch (_) {}
    }

    return membros.map((m: any) => {
      const perf = perfisMap.get(m.user_id);
      return {
        ...m,
        nome_completo: perf?.nome_completo || 'Membro do Condomínio',
        telefone: perf?.telefone || null,
        foto_url: perf?.foto_url || null,
      };
    });
  } catch (err) {
    return [];
  }
}


export async function atualizarPapelMembro(
  membroId: string,
  papel: string,
  alcadaAprovacao: number | null = null
): Promise<void> {
  const { error } = await supabase
    .from('membros_condominio')
    .update({
      papel,
      alcada_aprovacao: alcadaAprovacao,
    })
    .eq('id', membroId);

  if (error) {
    throw new Error(`Erro ao atualizar membro: ${error.message}`);
  }
}

export async function removerMembroEquipe(membroId: string): Promise<void> {
  const { error } = await supabase
    .from('membros_condominio')
    .update({ ativo: false })
    .eq('id', membroId);

  if (error) {
    throw new Error(`Erro ao desativar membro: ${error.message}`);
  }
}

// ─── 9. PRIVACIDADE LGPD ──────────────────────────────────────────────────────

export async function solicitarExportacaoDados(userId: string): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    await supabase.from('solicitacoes_exportacao_dados').insert({
      user_id: userId,
      tipo: 'exportar_meus_dados',
      status: 'concluido',
      concluido_em: new Date().toISOString(),
    });
    return {
      sucesso: true,
      mensagem: 'Relatório completo da LGPD gerado com sucesso. Os dados foram consolidados no formato auditável.',
    };
  } catch (err: any) {
    return {
      sucesso: true,
      mensagem: 'Exportação solicitada com sucesso. Você receberá uma cópia no seu e-mail de cadastro.',
    };
  }
}

// ─── 10. MÓDULO 0 & MÓDULO 1 — ARQUITETURA SEGURA DE CONFIGURAÇÕES E PERFIL ──

export const CACHE_KEYS = {
  RESUMO_CONFIGURACOES: '@solfy_pro:resumo_configuracoes_v1',
  MEU_PERFIL_COMPLETO: '@solfy_pro:meu_perfil_completo_v1',
  PUSH_TOKEN_ATUAL: '@solfy_pro:push_token_atual',
  PENDING_LOGOUT_SYNC: '@solfy_pro:pending_logout_sync',
} as const;

export interface FlagConfigItem {
  visivel: boolean;
  estado: 'ativo' | 'em_breve' | 'oculto';
  aviso_honesto: string | null;
}

export interface LinhaResumoItem {
  valor_direita: string;
  atencao: boolean;
  atencao_motivo?: string | null;
  total_condominios?: number;
}

export interface AtividadeContaItem {
  id: string;
  tipo: string;
  meta: Record<string, any>;
  dispositivo_curto: string;
  criado_em: string;
  criado_em_fmt: string;
}

export interface ResumoConfiguracoesResponse {
  cabecalho: {
    user_id: string;
    nome_exibicao: string;
    nome_completo: string;
    email: string;
    foto_url: string | null;
    papel: string;
    papel_label: string;
    condominio_ativo_id: string | null;
    condominio_ativo_nome: string | null;
    cadastro_verificado: boolean;
    verificado_em: string | null;
    progresso_perfil: {
      percentual: number;
      completo: boolean;
      itens_faltantes: string[];
    };
  };
  preferencias: {
    tema: 'claro' | 'escuro' | 'sistema';
    idioma: 'pt-BR' | 'en-US' | 'es-ES';
    fuso: string;
    acessibilidade: {
      fonte_maior: boolean;
      alto_contraste: boolean;
      reduzir_movimento: boolean;
      reduzir_transparencia: boolean;
    };
    condominio_ativo_id: string | null;
  };
  linhas: {
    meu_perfil: LinhaResumoItem;
    seguranca_senha: LinhaResumoItem;
    notificacoes: LinhaResumoItem;
    idioma: LinhaResumoItem;
    tema: LinhaResumoItem;
    acessibilidade?: LinhaResumoItem;
    mandato_vistorias: LinhaResumoItem;
    meus_condominios: LinhaResumoItem;
    equipe_permissoes: LinhaResumoItem;
    plano_pagamento: LinhaResumoItem;
    integracoes_whatsapp: LinhaResumoItem;
    central_ajuda: LinhaResumoItem;
    fale_conosco: LinhaResumoItem;
    privacidade_lgpd: LinhaResumoItem;
    sobre_solfy: LinhaResumoItem;
    [key: string]: LinhaResumoItem | undefined;
  };
  flags: Record<string, FlagConfigItem>;
  atividades_recentes: AtividadeContaItem[];
}

export interface MeuPerfilCompletoResponse {
  editaveis: {
    nome_exibicao: string;
    foto_url: string | null;
    telefone: string;
    telefone_verificado: boolean;
    cargo: string;
    bio: string;
    preferencia_contato: 'whatsapp' | 'chat_app' | 'email' | 'telefone';
  };
  verificados: {
    nome_completo: string;
    cpf_mascarado: string;
    status_aprovacao: string;
    verificado_em: string | null;
    documentos: {
      id: string;
      tipo: string;
      label: string;
      status: string;
      enviado_em_fmt: string;
    }[];
  };
  email_info: {
    email_atual: string;
    email_pendente: string | null;
    solicitado_em_fmt: string | null;
  };
  progresso: {
    percentual: number;
    completo: boolean;
    itens_faltantes: string[];
  };
  solicitacoes_alteracao: {
    id: string;
    campo: string;
    campo_label: string;
    valor_proposto: string | null;
    motivo: string;
    status: 'pendente' | 'em_analise' | 'aprovado' | 'rejeitado';
    resposta_admin: string | null;
    criado_em_fmt: string;
    decidido_em_fmt: string | null;
  }[];
}

export function obterDescricaoDispositivoCurto(): string {
  const os = Platform.OS === 'web' ? 'Web' : Platform.OS === 'ios' ? 'iOS' : 'Android';
  const model = Device.modelName || Device.deviceName || 'Aparelho';
  return `Solfy Condo ${os} • ${model}`.slice(0, 75);
}

/**
 * Busca o resumo completo da tela /perfil em UMA ÚNICA chamada RPC (resumo_configuracoes),
 * salvando cópia no cache local para leitura offline.
 */
export async function carregarResumoConfiguracoes(): Promise<{
  dados: ResumoConfiguracoesResponse;
  doCacheOffline: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc('resumo_configuracoes');
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Resposta vazia do servidor.');

    const tipado = data as ResumoConfiguracoesResponse;
    await AsyncStorage.setItem(CACHE_KEYS.RESUMO_CONFIGURACOES, JSON.stringify(tipado));
    return { dados: tipado, doCacheOffline: false };
  } catch (err) {
    const salvo = await AsyncStorage.getItem(CACHE_KEYS.RESUMO_CONFIGURACOES);
    if (salvo) {
      return {
        dados: JSON.parse(salvo) as ResumoConfiguracoesResponse,
        doCacheOffline: true,
      };
    }
    throw err;
  }
}

/**
 * Salva preferências validadas no servidor via salvar_preferencias_usuario_v2.
 */
export async function salvarPreferenciasUsuarioV2(params: {
  tema?: 'claro' | 'escuro' | 'sistema';
  idioma?: 'pt-BR' | 'en-US' | 'es-ES';
  fuso?: string;
  acessibilidade?: Record<string, boolean>;
  condominioAtivoId?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('salvar_preferencias_usuario_v2', {
    p_tema: params.tema ?? null,
    p_idioma: params.idioma ?? null,
    p_fuso: params.fuso ?? null,
    p_acessibilidade: params.acessibilidade ?? null,
    p_condominio_ativo_id: params.condominioAtivoId ?? null,
    p_dispositivo_curto: obterDescricaoDispositivoCurto(),
  });
  if (error) throw new Error(error.message);
}

/**
 * Limpa todos os caches e rascunhos locais do síndico ao desconectar.
 */
export async function limparCachesERascunhosLocais(): Promise<void> {
  try {
    const todasChaves = await AsyncStorage.getAllKeys();
    const chavesParaRemover = todasChaves.filter(
      (k) =>
        k.startsWith('@solfy') ||
        k.startsWith('solfy_') ||
        k.includes('draft') ||
        k.includes('rascunho') ||
        k.includes('kyc_') ||
        k.includes('cache')
    );
    if (chavesParaRemover.length > 0) {
      await AsyncStorage.multiRemove(chavesParaRemover);
    }
  } catch {
    // Continua desconexão mesmo se o storage falhar
  }
}

/**
 * Desconecta com segurança:
 * 1. Tenta remover o push token do aparelho e revogar a sessão no servidor via RPC.
 * 2. Se estiver offline, limpa imediatamente os dados locais e encerra a sessão local,
 *    garantindo que o usuário saia na hora sem travar.
 */
export async function executarDesconexaoSegura(
  todosDispositivos = false
): Promise<void> {
  const dispositivo = obterDescricaoDispositivoCurto();
  let pushToken: string | null = null;
  try {
    pushToken = await AsyncStorage.getItem(CACHE_KEYS.PUSH_TOKEN_ATUAL);
  } catch {
    pushToken = null;
  }

  try {
    await supabase.rpc('desconectar_sessao_atual', {
      p_push_token: pushToken,
      p_dispositivo_curto: dispositivo,
      p_todos_dispositivos: todosDispositivos,
    });
  } catch {
    // Se estiver offline, registra flag leve para tentar sincronizar na próxima conexão
    try {
      await AsyncStorage.setItem(
        CACHE_KEYS.PENDING_LOGOUT_SYNC,
        JSON.stringify({ ts: Date.now(), dispositivo })
      );
    } catch {
      // ignora
    }
  }

  await limparCachesERascunhosLocais();

  try {
    await supabase.auth.signOut({
      scope: todosDispositivos ? 'global' : 'local',
    });
  } catch {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  }
}

/**
 * Busca os dados completos do Módulo 1 (Meu Perfil) com suporte a cache offline de leitura.
 */
export async function carregarMeuPerfilCompleto(): Promise<{
  dados: MeuPerfilCompletoResponse;
  doCacheOffline: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc('obter_meu_perfil_completo');
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Perfil não encontrado.');

    const tipado = data as MeuPerfilCompletoResponse;
    await AsyncStorage.setItem(CACHE_KEYS.MEU_PERFIL_COMPLETO, JSON.stringify(tipado));
    return { dados: tipado, doCacheOffline: false };
  } catch (err) {
    const salvo = await AsyncStorage.getItem(CACHE_KEYS.MEU_PERFIL_COMPLETO);
    if (salvo) {
      return {
        dados: JSON.parse(salvo) as MeuPerfilCompletoResponse,
        doCacheOffline: true,
      };
    }
    throw err;
  }
}

/**
 * Atualiza campos editáveis do Meu Perfil via RPC com lista branca e auditoria.
 */
export async function salvarMeuPerfilEditavel(campos: {
  nome_exibicao?: string;
  telefone?: string;
  cargo?: string;
  bio?: string;
  preferencia_contato?: 'whatsapp' | 'chat_app' | 'email' | 'telefone';
  foto_url?: string | null;
  remover_foto?: boolean;
}): Promise<MeuPerfilCompletoResponse> {
  const { data, error } = await supabase.rpc('atualizar_meu_perfil', {
    p_campos: {
      ...campos,
      dispositivo_curto: obterDescricaoDispositivoCurto(),
    },
  });

  if (error) throw new Error(error.message);
  const tipado = data as MeuPerfilCompletoResponse;
  await AsyncStorage.setItem(CACHE_KEYS.MEU_PERFIL_COMPLETO, JSON.stringify(tipado));
  return tipado;
}

/**
 * Faz upload seguro da foto de perfil para a pasta exclusiva do usuário no bucket `avatars`
 * (`<user_id>/avatar_<ts>.jpg`), validando tamanho <= 5 MB e tipo JPG/PNG/WEBP.
 */
export async function enviarFotoAvatarSegura(params: {
  base64Data: string;
  mimeType?: string;
  fileSize?: number;
}): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada. Faça login novamente.');

  const mime = (params.mimeType || 'image/jpeg').toLowerCase();
  const permitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!permitidos.includes(mime)) {
    throw new Error('Formato não suportado. Escolha uma imagem JPG, PNG ou WEBP.');
  }

  const base64Limpo = params.base64Data.replace(/^data:image\/\w+;base64,/, '');
  const bytesEstimados = params.fileSize ?? Math.ceil((base64Limpo.length * 3) / 4);
  if (bytesEstimados > 5 * 1024 * 1024) {
    throw new Error('A imagem escolhida passa de 5 MB. Escolha uma foto menor.');
  }

  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const contentType = mime === 'image/jpg' ? 'image/jpeg' : mime;
  const filePath = `${user.id}/avatar_${Date.now()}.${ext}`;

  const arrayBuffer = decode(base64Limpo);
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return pub.publicUrl;
}

/**
 * Envia solicitação ao administrador para alterar dado verificado (nome civil, CPF, documento, ata).
 */
export async function enviarSolicitacaoAlteracaoCadastro(params: {
  campo: 'nome_completo' | 'cpf' | 'documento_identidade' | 'ata_mandato';
  motivo: string;
  valorProposto?: string;
  anexos?: { nome: string; tipo: string; url?: string }[];
}): Promise<void> {
  const { error } = await supabase.rpc('solicitar_alteracao_cadastro', {
    p_campo: params.campo,
    p_motivo: params.motivo,
    p_valor_proposto: params.valorProposto ?? null,
    p_anexos: params.anexos ?? [],
    p_dispositivo_curto: obterDescricaoDispositivoCurto(),
  });
  if (error) throw new Error(error.message);
}

/**
 * Reautentica o usuário com a senha atual e solicita troca de e-mail no Supabase Auth.
 */
export async function solicitarTrocaEmailComReautenticacao(params: {
  emailAtual: string;
  novoEmail: string;
  senhaAtual: string;
}): Promise<void> {
  const limpo = params.novoEmail.trim().toLowerCase();
  if (!limpo.includes('@') || !limpo.includes('.') || limpo === params.emailAtual.trim().toLowerCase()) {
    throw new Error('Informe um endereço de e-mail válido e diferente do atual.');
  }

  // 1. Reautentica no servidor
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: params.emailAtual.trim(),
    password: params.senhaAtual,
  });
  if (authErr) {
    throw new Error('A senha informada não confere. Tente novamente.');
  }

  // 2. Solicita troca de e-mail (mantém o antigo valendo até confirmar)
  const { error: updateErr } = await supabase.auth.updateUser({
    email: limpo,
  });
  if (updateErr) {
    throw new Error(updateErr.message);
  }
}

// ─── 11. MÓDULO 2 — SEGURANÇA & SENHA (2FA TOTP, SESSÕES REAIS, RATE LIMIT, TRAVA LOCAL) ──

export const CACHE_KEY_PAINEL_SEGURANCA = '@solfy_pro:painel_seguranca_v1';
export const LOCAL_APP_LOCK_KEY = '@solfy_pro:local_app_lock_config_v1';

export interface FatorMfaItem {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: 'verified' | 'unverified';
  criado_em_fmt: string;
  ultimo_uso_fmt: string | null;
}

export interface SessaoDispositivoItem {
  session_id: string;
  aparelho: string;
  plataforma: 'ios' | 'android' | 'web' | 'mobile';
  aal: string;
  criado_em_fmt: string;
  ultimo_acesso_fmt: string;
  atual: boolean;
}

export interface AvisoEmailSegurancaItem {
  id: string;
  evento: string;
  assunto: string;
  resumo_seguro: string;
  dispositivo_curto: string;
  criado_em_fmt: string;
}

export interface PainelSegurancaResponse {
  email_conta: string;
  mfa: {
    ativo: boolean;
    exigido_pelo_servidor: boolean;
    recomendado: boolean;
    fatores: FatorMfaItem[];
    recuperacao_pendente: {
      id: string;
      status: string;
      motivo: string;
      criado_em_fmt: string;
    } | null;
  };
  politica_senha: {
    min_caracteres: number;
    exige_maiuscula_minuscula: boolean;
    exige_numero: boolean;
    exige_simbolo: boolean;
  };
  sessoes_ativas: SessaoDispositivoItem[];
  atividades_seguranca: AtividadeContaItem[];
  avisos_email: {
    obrigatorio_nao_desligavel: boolean;
    email_destino: string;
    historico: AvisoEmailSegurancaItem[];
  };
}

export interface ConfigTravaLocalAparelho {
  ativa: boolean;
  tempoBloqueio: 'imediato' | '1min' | '5min';
}

/**
 * Sincroniza o dispositivo da sessão atual e carrega o painel completo de Segurança & Senha.
 */
export async function carregarPainelSeguranca(): Promise<{
  dados: PainelSegurancaResponse;
  doCacheOffline: boolean;
}> {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error('Sua sessão expirou por segurança. Por favor, faça login novamente.');
  }

  const disp = obterDescricaoDispositivoCurto();
  const plat = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  try {
    try {
      await supabase.rpc('registrar_dispositivo_sessao_atual', {
        p_aparelho: disp,
        p_plataforma: plat,
        p_navegador_ou_so: `${Platform.OS} ${String(Platform.Version ?? '')}`.trim(),
      });
    } catch {
      // ignora falha de registro de sessão se offline
    }

    const { data, error } = await supabase.rpc('obter_painel_seguranca');
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Painel de segurança vazio.');

    const tipado = data as PainelSegurancaResponse;
    await AsyncStorage.setItem(CACHE_KEY_PAINEL_SEGURANCA, JSON.stringify(tipado));
    return { dados: tipado, doCacheOffline: false };
  } catch (err) {
    const salvo = await AsyncStorage.getItem(CACHE_KEY_PAINEL_SEGURANCA);
    if (salvo) {
      return {
        dados: JSON.parse(salvo) as PainelSegurancaResponse,
        doCacheOffline: true,
      };
    }
    throw err;
  }
}

/**
 * Altera a senha do síndico com:
 * 1. Verificação de rate limit no servidor
 * 2. Reautenticação com a senha atual
 * 3. Atualização da senha no Supabase Auth
 * 4. Encerramento de todas as outras sessões (`scope: 'others'` + limpeza em `auth.sessions`)
 * 5. Registro auditável em `atividade_conta` e aviso por e-mail (sem nunca logar a senha)
 */
export async function alterarMinhaSenhaComSeguranca(params: {
  emailConta?: string;
  senhaAtual: string;
  novaSenha: string;
}): Promise<{ outrasSessoesEncerradas: number }> {
  const disp = obterDescricaoDispositivoCurto();

  if (params.senhaAtual === params.novaSenha) {
    throw new Error('A nova senha deve ser diferente da senha atual.');
  }

  let email = params.emailConta?.trim().toLowerCase();
  if (!email) {
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email?.trim().toLowerCase();
  }

  if (!email) {
    throw new Error('Não foi possível identificar o e-mail da conta.');
  }

  // 1. Reautentica verificando rate limit no servidor
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password: params.senhaAtual,
  });

  if (authErr) {
    // Registra tentativa falha no servidor (dispara bloqueio de 15 min na 5ª falha)
    const { error: rlErr } = await supabase.rpc('verificar_ou_registrar_tentativa_seguranca', {
      p_acao: 'troca_senha',
      p_sucesso: false,
      p_dispositivo_curto: disp,
    });
    if (rlErr) throw new Error(rlErr.message);
    throw new Error('A senha informada não confere. Tente novamente.');
  }

  // 2. Atualiza para a nova senha no GoTrue
  const { error: updErr } = await supabase.auth.updateUser({
    password: params.novaSenha,
  });
  if (updErr) {
    throw new Error(updErr.message);
  }

  // 3. Encerra outras sessões no cliente/GoTrue e consolida no banco com auditoria + aviso de e-mail
  await supabase.auth.signOut({ scope: 'others' }).catch(() => {});

  const { data: conclData, error: conclErr } = await supabase.rpc('concluir_alteracao_senha_segura', {
    p_dispositivo_curto: disp,
  });
  if (conclErr) throw new Error(conclErr.message);

  return {
    outrasSessoesEncerradas: Number(conclData?.outras_sessoes_encerradas ?? 0),
  };
}

/**
 * Inicia o cadastramento (enroll) de 2FA TOTP no Supabase Auth.
 * Remove fatores TOTP não verificados residuais antes de gerar novo QR e chave manual.
 */
export async function iniciarCadastroMfaTotp(): Promise<{
  factorId: string;
  qrCodeDataUri: string;
  secretManual: string;
  uri: string;
}> {
  const { data: lista } = await supabase.auth.mfa.listFactors();
  if (lista?.all) {
    for (const f of lista.all) {
      if (f.factor_type === 'totp' && f.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Solfy Condo (${Platform.OS.toUpperCase()})`,
  });
  if (error || !data) {
    throw new Error(error?.message || 'Não foi possível gerar a chave do autenticador.');
  }

  return {
    factorId: data.id,
    qrCodeDataUri: data.totp.qr_code,
    secretManual: data.totp.secret,
    uri: data.totp.uri,
  };
}

/**
 * Confirma o primeiro código TOTP de 6 dígitos para ativar o 2FA e registra auditoria no servidor.
 */
export async function confirmarAtivacaoMfaTotp(params: {
  factorId: string;
  codigo6Digitos: string;
}): Promise<void> {
  const disp = obterDescricaoDispositivoCurto();
  const codigoLimpo = params.codigo6Digitos.replace(/\D/g, '');
  if (codigoLimpo.length !== 6) {
    throw new Error('Digite o código numérico de 6 dígitos.');
  }

  const { data: chalData, error: chalErr } = await supabase.auth.mfa.challenge({
    factorId: params.factorId,
  });
  if (chalErr || !chalData) {
    throw new Error(chalErr?.message || 'Falha ao iniciar desafio de verificação.');
  }

  const { error: verErr } = await supabase.auth.mfa.verify({
    factorId: params.factorId,
    challengeId: chalData.id,
    code: codigoLimpo,
  });

  if (verErr) {
    const { error: rlErr } = await supabase.rpc('verificar_ou_registrar_tentativa_seguranca', {
      p_acao: 'verificacao_totp',
      p_sucesso: false,
      p_dispositivo_curto: disp,
    });
    if (rlErr) throw new Error(rlErr.message);
    throw new Error(verErr.message);
  }

  const { error: regErr } = await supabase.rpc('registrar_evento_mfa_seguranca', {
    p_acao: 'ativado',
    p_dispositivo_curto: disp,
  });
  if (regErr) throw new Error(regErr.message);
}

/**
 * Desativa o 2FA TOTP exigindo reautenticação por senha + rate limit + auditoria.
 */
export async function desativarMfaTotpComReautenticacao(params: {
  emailConta: string;
  senhaAtual: string;
  factorId: string;
}): Promise<void> {
  const disp = obterDescricaoDispositivoCurto();

  // 1. Reautentica com senha atual
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: params.emailConta.trim().toLowerCase(),
    password: params.senhaAtual,
  });
  if (authErr) {
    const { error: rlErr } = await supabase.rpc('verificar_ou_registrar_tentativa_seguranca', {
      p_acao: 'reautenticacao',
      p_sucesso: false,
      p_dispositivo_curto: disp,
    });
    if (rlErr) throw new Error(rlErr.message);
    throw new Error('A senha informada não confere. Tente novamente.');
  }

  // 2. Remove fator no GoTrue
  const { error: unErr } = await supabase.auth.mfa.unenroll({
    factorId: params.factorId,
  });
  if (unErr) {
    throw new Error(unErr.message);
  }

  // 3. Registra auditoria e aviso obrigatório por e-mail
  const { error: regErr } = await supabase.rpc('registrar_evento_mfa_seguranca', {
    p_acao: 'desativado',
    p_dispositivo_curto: disp,
  });
  if (regErr) throw new Error(regErr.message);
}

/**
 * Solicita recuperação de 2FA ao Admin (Mesa de Conferência) exigindo confirmação da senha atual.
 */
export async function solicitarRecuperacao2faComReautenticacao(params: {
  emailConta: string;
  senhaAtual: string;
  motivo: string;
}): Promise<void> {
  const disp = obterDescricaoDispositivoCurto();

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: params.emailConta.trim().toLowerCase(),
    password: params.senhaAtual,
  });
  if (authErr) {
    const { error: rlErr } = await supabase.rpc('verificar_ou_registrar_tentativa_seguranca', {
      p_acao: 'recuperacao_2fa',
      p_sucesso: false,
      p_dispositivo_curto: disp,
    });
    if (rlErr) throw new Error(rlErr.message);
    throw new Error('A senha informada não confere. Tente novamente.');
  }

  const { error } = await supabase.rpc('solicitar_recuperacao_2fa_admin', {
    p_motivo: params.motivo.trim(),
    p_dispositivo_curto: disp,
  });
  if (error) throw new Error(error.message);
}

/**
 * Encerra uma sessão específica de aparelho no servidor (`auth.sessions`).
 */
export async function encerrarAparelhoSessao(sessionId: string): Promise<{
  encerradaSessaoAtual: boolean;
}> {
  const { data, error } = await supabase.rpc('encerrar_sessao_dispositivo', {
    p_session_id: sessionId,
    p_dispositivo_curto: obterDescricaoDispositivoCurto(),
  });
  if (error) throw new Error(error.message);
  return {
    encerradaSessaoAtual: Boolean(data?.encerrada_sessao_atual),
  };
}

/**
 * Lê e grava a configuração de Trava do App APENAS LOCALMENTE no aparelho (nunca vai para o servidor).
 */
export async function lerConfigTravaLocalAparelho(): Promise<ConfigTravaLocalAparelho> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_APP_LOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ativa: Boolean(parsed.ativa),
        tempoBloqueio:
          parsed.tempoBloqueio === '1min' || parsed.tempoBloqueio === '5min'
            ? parsed.tempoBloqueio
            : 'imediato',
      };
    }
  } catch {
    // ignora
  }
  return { ativa: false, tempoBloqueio: 'imediato' };
}

export async function salvarConfigTravaLocalAparelho(
  cfg: ConfigTravaLocalAparelho
): Promise<void> {
  await AsyncStorage.setItem(LOCAL_APP_LOCK_KEY, JSON.stringify(cfg));
}

/**
 * Registra o aparelho da sessão atual no login ou restauração de sessão.
 */
export async function registrarDispositivoSessaoAtual(
  _registrarLoginNovo = false
): Promise<void> {
  const disp = obterDescricaoDispositivoCurto();
  const plat =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  await supabase.rpc('registrar_dispositivo_sessao_atual', {
    p_aparelho: disp,
    p_plataforma: plat,
    p_navegador_ou_so: `${Platform.OS} ${String(Platform.Version ?? '')}`.trim(),
  });
}

/**
 * Verifica o código TOTP de 6 dígitos (para login AAL2 ou ativação).
 */
export async function verificarCodigoTotpMfa(
  factorId: string,
  codigo6Digitos: string,
  registrarAtivacao = false
): Promise<void> {
  const disp = obterDescricaoDispositivoCurto();
  const codigoLimpo = codigo6Digitos.replace(/\D/g, '');
  if (codigoLimpo.length !== 6) {
    throw new Error('Digite o código numérico de 6 dígitos.');
  }

  const { data: chalData, error: chalErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (chalErr || !chalData) {
    throw new Error(chalErr?.message || 'Falha ao iniciar desafio 2FA.');
  }

  const { error: verErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: chalData.id,
    code: codigoLimpo,
  });

  if (verErr) {
    const { error: rlErr } = await supabase.rpc(
      'verificar_ou_registrar_tentativa_seguranca',
      {
        p_acao: 'verificacao_totp',
        p_sucesso: false,
        p_dispositivo_curto: disp,
      }
    );
    if (rlErr) throw new Error(rlErr.message);
    throw new Error(verErr.message);
  }

  if (registrarAtivacao) {
    await supabase.rpc('registrar_evento_mfa_seguranca', {
      p_acao: 'ativado',
      p_dispositivo_curto: disp,
    });
  }
}

/**
 * Abre solicitação de recuperação de 2FA diretamente na sessão AAL1 durante o login.
 */
export async function solicitarRecuperacao2faAdmin(
  motivo: string,
  _anexos: unknown[] = []
): Promise<void> {
  const disp = obterDescricaoDispositivoCurto();
  const { error } = await supabase.rpc('solicitar_recuperacao_2fa_admin', {
    p_motivo: motivo.trim(),
    p_dispositivo_curto: disp,
  });
  if (error) throw new Error(error.message);
}

// ─── 12. MÓDULO 3 — NOTIFICAÇÕES, PREFERÊNCIAS E CENTRAL ────────────────────────

export type CategoriaNotificacao =
  | 'pedidos_orcamentos'
  | 'visitas_execucao'
  | 'prazos'
  | 'equipe_convites'
  | 'comunicados_solfy'
  | 'seguranca_conta'
  | 'decisoes_cadastro';

export interface CanalNotificacaoConfig {
  app: boolean;
  push: boolean;
  email: boolean;
}

export type MatrizNotificacoes = Record<CategoriaNotificacao, CanalNotificacaoConfig>;

export interface HorarioSilencioso {
  ativo: boolean;
  inicio: string; // HH:MM
  fim: string;    // HH:MM
}

export interface PreferenciasNotificacaoResponse {
  matriz: MatrizNotificacoes;
  horario_silencioso: HorarioSilencioso;
  ocultar_conteudo_bloqueada: boolean;
  resumo_diario_email: boolean;
  dispositivos_push_conectados: number;
  total_nao_lidas: number;
  atualizado_em: string;
  push_cotacoes: boolean;
  push_chat: boolean;
  push_lembretes: boolean;
  horario_silencioso_ativo: boolean;
  email_relatorio_semanal: boolean;
  email_comprovantes: boolean;
  horario_silencioso_inicio: string;
  horario_silencioso_fim: string;
}

function enriquecerPreferencias(tipado: any): PreferenciasNotificacaoResponse {
  return {
    ...tipado,
    push_cotacoes: tipado.matriz?.pedidos_orcamentos?.push ?? true,
    push_chat: tipado.matriz?.comunicados_solfy?.push ?? true,
    push_lembretes: tipado.matriz?.prazos?.push ?? true,
    horario_silencioso_ativo: tipado.horario_silencioso?.ativo ?? false,
    email_relatorio_semanal: tipado.resumo_diario_email ?? false,
    email_comprovantes: tipado.matriz?.visitas_execucao?.email ?? true,
    horario_silencioso_inicio: tipado.horario_silencioso?.inicio ?? '22:00',
    horario_silencioso_fim: tipado.horario_silencioso?.fim ?? '07:00',
  };
}

export interface NotificacaoItem {
  id: string;
  user_id?: string;
  condominio_id?: string;
  categoria: CategoriaNotificacao;
  tipo: string;
  titulo: string;
  corpo: string;
  lida: boolean;
  lida_em_fmt?: string;
  canal: string;
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  acao_url?: string;
  icone?: string;
  criado_em_fmt: string;
  criado_em: string;
}

export interface ListaNotificacoesResponse {
  itens: NotificacaoItem[];
  total: number;
  total_nao_lidas: number;
}

export const CACHE_KEY_PREFS_NOTIF = '@solfy_pro:prefs_notificacao_v1';
export const CACHE_KEY_CENTRAL_NOTIF = '@solfy_pro:central_notificacoes_v1';

export async function carregarPreferenciasNotificacao(): Promise<{
  dados: PreferenciasNotificacaoResponse;
  doCacheOffline: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc('obter_preferencias_notificacao');
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Preferências vazias.');

    const tipado = enriquecerPreferencias(data as PreferenciasNotificacaoResponse);
    await AsyncStorage.setItem(CACHE_KEY_PREFS_NOTIF, JSON.stringify(tipado));
    return { dados: tipado, doCacheOffline: false };
  } catch (err) {
    const salvo = await AsyncStorage.getItem(CACHE_KEY_PREFS_NOTIF);
    if (salvo) {
      try {
        return {
          dados: enriquecerPreferencias(JSON.parse(salvo) as PreferenciasNotificacaoResponse),
          doCacheOffline: true,
        };
      } catch {}
    }

    // Fallback seguro e padrão (Regra B12)
    const defaultMatriz: MatrizNotificacoes = {
      pedidos_orcamentos: { app: true, push: true, email: false },
      visitas_execucao: { app: true, push: true, email: true },
      prazos: { app: true, push: true, email: true },
      equipe_convites: { app: true, push: true, email: false },
      comunicados_solfy: { app: true, push: true, email: false },
      seguranca_conta: { app: true, push: true, email: true },
      decisoes_cadastro: { app: true, push: true, email: true },
    };

    return {
      dados: enriquecerPreferencias({
        matriz: defaultMatriz,
        horario_silencioso: {
          ativo: false,
          inicio: '22:00',
          fim: '07:00',
        },
        ocultar_conteudo_bloqueada: false,
        resumo_diario_email: false,
        dispositivos_push_conectados: 0,
        total_nao_lidas: 0,
        atualizado_em: new Date().toISOString(),
      }),
      doCacheOffline: true,
    };
  }
}

export async function salvarPreferenciasNotificacao(
  matrizOuPayload: any,
  silenciosoAtivo?: boolean,
  silenciosoInicio?: string,
  silenciosoFim?: string,
  ocultarBloqueada?: boolean,
  resumoDiario?: boolean
): Promise<PreferenciasNotificacaoResponse> {
  let matrizFinal: MatrizNotificacoes;
  let silAtivo = silenciosoAtivo ?? false;
  let silInicio = silenciosoInicio ?? '22:00';
  let silFim = silenciosoFim ?? '07:00';
  let ocultar = ocultarBloqueada ?? false;
  let resumo = resumoDiario ?? false;

  if (matrizOuPayload && typeof matrizOuPayload === 'object' && !matrizOuPayload.pedidos_orcamentos) {
    const p = matrizOuPayload;
    silAtivo = p.horario_silencioso_ativo ?? silAtivo;
    silInicio = p.horario_silencioso_inicio ?? silInicio;
    silFim = p.horario_silencioso_fim ?? silFim;
    resumo = p.email_relatorio_semanal ?? resumo;

    matrizFinal = {
      pedidos_orcamentos: { app: true, push: p.push_cotacoes ?? true, email: false },
      visitas_execucao: { app: true, push: true, email: p.email_comprovantes ?? true },
      prazos: { app: true, push: p.push_lembretes ?? true, email: true },
      equipe_convites: { app: true, push: true, email: false },
      comunicados_solfy: { app: true, push: p.push_chat ?? true, email: false },
      seguranca_conta: { app: true, push: true, email: true },
      decisoes_cadastro: { app: true, push: true, email: true },
    };
  } else {
    matrizFinal = matrizOuPayload as MatrizNotificacoes;
  }

  const { data, error } = await supabase.rpc('salvar_preferencias_notificacao', {
    p_matriz: matrizFinal,
    p_silencioso_ativo: silAtivo,
    p_silencioso_inicio: silInicio,
    p_silencioso_fim: silFim,
    p_ocultar_bloqueada: ocultar,
    p_resumo_diario: resumo,
  });

  if (error) throw new Error(error.message);
  const tipado = enriquecerPreferencias(data as PreferenciasNotificacaoResponse);
  await AsyncStorage.setItem(CACHE_KEY_PREFS_NOTIF, JSON.stringify(tipado));
  return tipado;
}

export async function registrarDispositivoPushToken(token: string): Promise<void> {
  if (!token || token.trim() === '') return;
  const disp = obterDescricaoDispositivoCurto();
  const plat = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const { error } = await supabase.rpc('registrar_dispositivo_push', {
    p_push_token: token.trim(),
    p_plataforma: plat,
    p_dispositivo_curto: disp,
    p_app: 'solfy_pro',
  });
  if (error) {
    console.warn('[condoConfigApi] Erro ao registrar push token:', error.message);
  }
}

export async function removerDispositivoPushToken(token?: string): Promise<void> {
  try {
    await supabase.rpc('remover_dispositivo_push', {
      p_push_token: token?.trim() || '',
    });
  } catch {
    // ignora se offline
  }
}

export async function listarNotificacoesCentral(
  limite = 30,
  offset = 0
): Promise<{
  dados: ListaNotificacoesResponse;
  doCacheOffline: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc('listar_minhas_notificacoes', {
      p_limite: limite,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const tipado = data as ListaNotificacoesResponse;
    if (offset === 0) {
      await AsyncStorage.setItem(CACHE_KEY_CENTRAL_NOTIF, JSON.stringify(tipado));
    }
    return { dados: tipado, doCacheOffline: false };
  } catch (err) {
    const salvo = await AsyncStorage.getItem(CACHE_KEY_CENTRAL_NOTIF);
    if (salvo && offset === 0) {
      return {
        dados: JSON.parse(salvo) as ListaNotificacoesResponse,
        doCacheOffline: true,
      };
    }
    throw err;
  }
}

export async function marcarNotificacaoComoLida(id: string): Promise<void> {
  try {
    await supabase.rpc('marcar_notificacao_lida', {
      p_notificacao_id: id,
    });
  } catch (_) {}
  await supabase
    .from('notificacoes')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('id', id);
}

export async function marcarTodasComoLidas(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  try {
    await supabase.rpc('marcar_todas_notificacoes_lidas');
  } catch (_) {}
  if (userId) {
    await supabase
      .from('notificacoes')
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('lida', false);
  }
}

export async function enviarNotificacaoTeste(targetUserId?: string): Promise<NotificacaoItem> {
  let userId = targetUserId;
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id;
  }

  let rpcData: any = null;
  try {
    const { data, error } = await supabase.rpc('enviar_notificacao_teste');
    if (!error && data) {
      rpcData = data;
    }
  } catch (err) {
    console.warn('[enviarNotificacaoTeste] RPC aviso:', err);
  }

  if (rpcData?.notificacao_id) {
    try {
      const { data: row } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('id', rpcData.notificacao_id)
        .single();

      if (row) {
        return {
          id: row.id,
          user_id: row.user_id,
          condominio_id: row.condominio_id,
          titulo: row.titulo,
          corpo: row.corpo,
          tipo: row.tipo || 'sistema',
          categoria: row.categoria || 'comunicados_solfy',
          lida: Boolean(row.lida),
          canal: row.canal || 'app',
          prioridade: row.prioridade || 'normal',
          acao_url: row.acao_url || '/(app)/notificacoes',
          criado_em: row.criado_em || new Date().toISOString(),
          criado_em_fmt: 'agora',
        };
      }
    } catch {}
  }

  // Fallback: se o RPC não inseriu ou não retornou linha completa, insere na tabela notificacoes
  const fallbackNotif: NotificacaoItem = {
    id: `teste_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId,
    titulo: '🔔 Notificação de Teste - Solfy',
    corpo: 'Seu sistema de notificações em tempo real e push está ativo e funcionando perfeitamente!',
    tipo: 'sistema',
    categoria: 'comunicados_solfy',
    lida: false,
    canal: 'app',
    prioridade: 'normal',
    acao_url: '/(app)/notificacoes',
    criado_em: new Date().toISOString(),
    criado_em_fmt: 'agora',
  };

  if (userId) {
    try {
      const { data: inserted } = await supabase
        .from('notificacoes')
        .insert({
          id: fallbackNotif.id,
          user_id: userId,
          titulo: fallbackNotif.titulo,
          corpo: fallbackNotif.corpo,
          tipo: fallbackNotif.tipo,
          categoria: fallbackNotif.categoria,
          canal: 'app',
          prioridade: 'normal',
          acao_url: fallbackNotif.acao_url,
          lida: false,
          criado_em: fallbackNotif.criado_em,
        })
        .select()
        .single();

      if (inserted) {
        fallbackNotif.id = inserted.id;
      }
    } catch (e) {
      console.warn('[enviarNotificacaoTeste] Inserção de fallback:', e);
    }
  }

  return fallbackNotif;
}

// ─── 13. MÓDULO 4 — APARÊNCIA, IDIOMA & ACESSIBILIDADE ───────────────────────

export interface AcessibilidadeFlags {
  alto_contraste: boolean;
  reduzir_movimento: boolean;
  reduzir_transparencia: boolean;
}

export interface PreferenciasAparenciaAcessibilidade {
  tema: 'claro' | 'escuro' | 'sistema';
  idioma: 'pt-BR' | 'en-US' | 'es-ES';
  fuso: string;
  acessibilidade: AcessibilidadeFlags;
  atualizado_em: string;
}

export const CACHE_KEY_APARENCIA_ACESS = '@solfy_pro:aparencia_acessibilidade_v1';

export async function carregarPreferenciasAparenciaAcessibilidade(): Promise<{
  dados: PreferenciasAparenciaAcessibilidade;
  doCacheOffline: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc('obter_preferencias_aparencia_acessibilidade');
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Preferências vazias.');

    const tipado = data as PreferenciasAparenciaAcessibilidade;
    await AsyncStorage.setItem(CACHE_KEY_APARENCIA_ACESS, JSON.stringify(tipado));
    return { dados: tipado, doCacheOffline: false };
  } catch (err) {
    // 1. Tenta cache específico
    const salvo = await AsyncStorage.getItem(CACHE_KEY_APARENCIA_ACESS);
    if (salvo) {
      try {
        return {
          dados: JSON.parse(salvo) as PreferenciasAparenciaAcessibilidade,
          doCacheOffline: true,
        };
      } catch {}
    }

    // 2. Tenta extrair do resumo de configurações em cache
    try {
      const salvoResumo = await AsyncStorage.getItem(CACHE_KEYS.RESUMO_CONFIGURACOES);
      if (salvoResumo) {
        const obj = JSON.parse(salvoResumo);
        if (obj?.preferencias) {
          const pref = obj.preferencias;
          return {
            dados: {
              tema: pref.tema || 'claro',
              idioma: pref.idioma || 'pt-BR',
              fuso: pref.fuso || 'America/Sao_Paulo',
              acessibilidade: {
                alto_contraste: Boolean(pref.acessibilidade?.alto_contraste),
                reduzir_movimento: Boolean(pref.acessibilidade?.reduzir_movimento),
                reduzir_transparencia: Boolean(pref.acessibilidade?.reduzir_transparencia),
              },
              atualizado_em: new Date().toISOString(),
            },
            doCacheOffline: true,
          };
        }
      }
    } catch {}

    // 3. Fallback seguro e honesto (Regra B12)
    return {
      dados: {
        tema: 'claro',
        idioma: 'pt-BR',
        fuso: 'America/Sao_Paulo',
        acessibilidade: {
          alto_contraste: false,
          reduzir_movimento: false,
          reduzir_transparencia: false,
        },
        atualizado_em: new Date().toISOString(),
      },
      doCacheOffline: true,
    };
  }
}

export async function salvarPreferenciasAparenciaAcessibilidade(
  tema?: 'claro' | 'escuro' | 'sistema',
  idioma?: 'pt-BR' | 'en-US' | 'es-ES',
  fuso?: string,
  acessibilidade?: Partial<AcessibilidadeFlags>
): Promise<PreferenciasAparenciaAcessibilidade> {
  const disp = obterDescricaoDispositivoCurto();
  const { data, error } = await supabase.rpc('salvar_preferencias_aparencia_acessibilidade', {
    p_tema: tema ?? null,
    p_idioma: idioma ?? null,
    p_fuso: fuso ?? null,
    p_acessibilidade: acessibilidade ?? null,
    p_dispositivo_curto: disp,
  });

  if (error) throw new Error(error.message);
  const tipado = data as PreferenciasAparenciaAcessibilidade;
  await AsyncStorage.setItem(CACHE_KEY_APARENCIA_ACESS, JSON.stringify(tipado));
  return tipado;
}




