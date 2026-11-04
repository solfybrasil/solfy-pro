import { supabase } from './supabase';

export type EstadoPedidoPrestador =
  | 'convite_pendente'
  | 'aceito_escolher_caminho'
  | 'visita_agendada'
  | 'aguardando_cotacao'
  | 'cotacao_enviada'
  | 'aprovada'
  | 'concluida'
  | 'recusado'
  | 'expirado'
  | 'vagas_preenchidas'
  | 'cancelada'
  | 'recebido';

export interface LocalizacaoPrivacidade {
  aceito: boolean;
  bairro: string;
  cidade: string;
  estado: string;
  distancia_km?: number | null;
  condominio_id?: string | null;
  condominio_nome?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco_completo?: string | null;
}

export interface OportunidadePrestador {
  id: string; // solicitacao_id
  solicitacao_id: string;
  despacho_id: string;
  prestador_id: string;
  status_prestador: string; // 'notificado', 'visualizado', 'aceito_cotar', 'recusado'
  estado_fluxo: EstadoPedidoPrestador;
  notificado_em: string;
  respondido_em?: string | null;
  titulo: string;
  categoria: string;
  descricao: string;
  urgencia: 'baixa' | 'normal' | 'alta' | 'urgente';
  status_solicitacao: string;
  condominio_nome: string;
  localizacao_exibida: string;
  fotos_urls: string[];
  prazo_desejado?: string | null;
  janela_horario_preferida?: string | null;
  visita_janela_data_inicio?: string | null;
  visita_janela_data_fim?: string | null;
  visita_janela_horario_inicio?: string | null;
  visita_janela_horario_fim?: string | null;
  local_especifico?: string | null;
  acesso_observacoes?: string | null;
  forma_pagamento_prevista?: string | null;
  // Dados de visita técnica
  visita?: {
    id: string;
    data_visita: string;
    horario_inicio: string;
    horario_fim: string;
    status: string;
    observacoes?: string | null;
    ja_passou: boolean;
  } | null;
  // Dados da cotação do prestador
  cotacao?: {
    id: string;
    valor: number;
    prazo_execucao_dias: number;
    observacoes?: string | null;
    selecionada: boolean;
    criado_em: string;
    status?: string;
    garantia_meses?: number;
    condicoes_pagamento?: string | null;
    origem_cotacao?: string;
  } | null;
  local?: LocalizacaoPrivacidade;
  data_aceite?: string | null;
  prazo_limite_aceite?: string | null;
  segundos_restantes_aceite?: number;
  prazo_horas_aceite?: number;
  eh_emergencia?: boolean;
  cotacoes_recebidas_count?: number;
  max_cotacoes?: number;
  finalizacao_status?: string | null;
  valor_fechado?: number | null;
}

/**
 * Normaliza e calcula o estado claro do pedido no funil do prestador
 */
export function calcularEstadoPrestador(
  despachoStatus: string,
  visita: { data_visita: string; horario_fim: string; status: string } | null,
  cotacao: { selecionada: boolean; status?: string } | null,
  solicitacaoStatus: string,
  finalizacaoStatus?: string | null
): EstadoPedidoPrestador {
  if (solicitacaoStatus === 'cancelada') return 'cancelada';
  if (despachoStatus === 'recusado') return 'recusado';
  if (despachoStatus === 'sem_resposta' || despachoStatus === 'expirado') return 'expirado';
  if (despachoStatus === 'vagas_preenchidas') return 'vagas_preenchidas';

  // Se a solicitação ou a finalização bilateral estiver concluída (comissão gerada/faturada)
  if (
    (cotacao?.selecionada || cotacao?.status === 'aprovada') &&
    (solicitacaoStatus === 'concluida' || finalizacaoStatus === 'concluida')
  ) {
    return 'concluida';
  }

  // Se a solicitação foi concluída por outro prestador e este não foi selecionado
  if (solicitacaoStatus === 'concluida' && (!cotacao || !cotacao.selecionada)) {
    return 'recusado';
  }

  if (cotacao) {
    if (
      cotacao.selecionada ||
      cotacao.status === 'aprovada' ||
      solicitacaoStatus === 'em_execucao' ||
      solicitacaoStatus === 'concluida'
    ) {
      return 'aprovada';
    }
    if (
      cotacao.status === 'recusada' ||
      (solicitacaoStatus !== 'aberta' && solicitacaoStatus !== 'aguardando_cotacao' && !cotacao.selecionada)
    ) {
      return 'recusado';
    }
    return 'cotacao_enviada';
  }

  if (visita && visita.status !== 'cancelada') {
    const agora = new Date();
    const fimVisita = new Date(`${visita.data_visita}T${visita.horario_fim}`);
    if (isNaN(fimVisita.getTime()) || agora < fimVisita) {
      return 'visita_agendada';
    }
    return 'aguardando_cotacao';
  }

  if (despachoStatus === 'aceito_cotar') {
    return 'aceito_escolher_caminho';
  }

  if (despachoStatus === 'notificado' || despachoStatus === 'visualizado') {
    return 'convite_pendente';
  }

  return 'recebido';
}

/**
 * 1. LISTAR OPORTUNIDADES / PEDIDOS DESPACHADOS PARA O PRESTADOR
 */
export async function buscarOportunidadesPrestador(
  prestadorId: string
): Promise<OportunidadePrestador[]> {
  if (!prestadorId) return [];

  try {
    // 1. Busca os despachos ativos para o prestador
    const { data: despachos, error: despErr } = await supabase
      .from('solicitacao_despacho')
      .select(`
        id,
        solicitacao_id,
        prestador_id,
        status_prestador,
        decisao_prestador,
        estado_fluxo,
        notificado_em,
        respondido_em,
        solicitacao:solicitacoes (
          id,
          titulo,
          categoria,
          descricao,
          urgencia,
          status,
          cancelamento_motivo,
          cancelado_em,
          prazo_desejado,
          janela_horario_preferida,
          visita_janela_data_inicio,
          visita_janela_data_fim,
          visita_janela_horario_inicio,
          visita_janela_horario_fim,
          forma_pagamento_prevista,
          local_especifico,
          acesso_observacoes,
          fotos_urls,
          criado_em,
          condominio:condominios (
            id,
            nome,
            endereco
          )
        )
      `)
      .eq('prestador_id', prestadorId)
      .order('notificado_em', { ascending: false })
      .limit(50);

    if (despErr || !despachos) {
      console.warn('[PrestadorPedidosAPI] Erro ao buscar despachos:', despErr);
      return [];
    }

    const solicitacaoIds = despachos
      .map((d: any) => d.solicitacao?.id)
      .filter(Boolean);

    if (solicitacaoIds.length === 0) return [];

    // 2. Busca visitas do prestador para estas solicitações
    const { data: visitas } = await supabase
      .from('solicitacao_visitas_tecnicas')
      .select('id, solicitacao_id, prestador_id, data_visita, horario_inicio, horario_fim, status, observacoes')
      .eq('prestador_id', prestadorId)
      .in('solicitacao_id', solicitacaoIds)
      .neq('status', 'cancelada');

    const mapaVisitas = new Map<string, any>();
    (visitas || []).forEach((v) => mapaVisitas.set(v.solicitacao_id, v));

    // 3. Busca cotações do prestador para estas solicitações
    const { data: cotacoes } = await supabase
      .from('cotacoes')
      .select('id, solicitacao_id, prestador_id, valor, prazo_execucao_dias, observacoes, selecionada, criado_em, garantia_meses, condicoes_pagamento, origem_cotacao, status')
      .eq('prestador_id', prestadorId)
      .in('solicitacao_id', solicitacaoIds)
      .order('selecionada', { ascending: false })
      .order('criado_em', { ascending: false });

    const mapaCotacoes = new Map<string, any>();
    (cotacoes || []).forEach((c) => {
      if (!mapaCotacoes.has(c.solicitacao_id)) {
        mapaCotacoes.set(c.solicitacao_id, c);
      }
    });

    // 3.5. Busca finalizações bilaterais (contrato/comissão)
    const { data: finalizacoes } = await supabase
      .from('solicitacao_finalizacoes')
      .select('solicitacao_id, status, valor_fechado_centavos')
      .in('solicitacao_id', solicitacaoIds);

    const mapaFinalizacoes = new Map<string, any>();
    (finalizacoes || []).forEach((fin) => {
      mapaFinalizacoes.set(fin.solicitacao_id, fin);
    });

    // 4. Monta o array unificado
    const agora = new Date();
    const lista: OportunidadePrestador[] = [];

    for (const d of despachos) {
      const s = (d as any).solicitacao;
      if (!s) continue;

      const v = mapaVisitas.get(s.id) || null;
      const c = mapaCotacoes.get(s.id) || null;
      const fin = mapaFinalizacoes.get(s.id) || null;

      let visitaFormatada = null;
      if (v) {
        const fimV = new Date(`${v.data_visita}T${v.horario_fim}`);
        visitaFormatada = {
          ...v,
          ja_passou: !isNaN(fimV.getTime()) && agora >= fimV,
        };
      }

      const estadoCalculado = calcularEstadoPrestador(
        d.status_prestador,
        visitaFormatada,
        c,
        s.status,
        fin?.status
      );

      const condo = s.condominio;
      let locExibida = 'Localização aproximada';
      if (condo?.endereco) {
        if (typeof condo.endereco === 'object') {
          const endObj = condo.endereco as any;
          const bairro = endObj.bairro || '';
          const cidade = endObj.cidade || '';
          if (bairro) {
            locExibida = `${bairro}, ${cidade || 'SP'}`;
          } else if (cidade) {
            locExibida = cidade;
          }
        } else if (typeof condo.endereco === 'string') {
          locExibida = condo.endereco;
        }
      }

      lista.push({
        id: s.id,
        solicitacao_id: s.id,
        despacho_id: d.id,
        prestador_id: d.prestador_id,
        status_prestador: d.status_prestador,
        estado_fluxo: estadoCalculado,
        notificado_em: d.notificado_em,
        respondido_em: d.respondido_em,
        titulo: s.titulo || `${s.categoria || 'Demanda'} Predial`,
        categoria: s.categoria || 'Manutenção Predial',
        descricao: s.descricao || '',
        urgencia: s.urgencia || 'normal',
        status_solicitacao: s.status,
        condominio_nome: condo?.nome || 'Condomínio Residencial',
        localizacao_exibida: locExibida,
        fotos_urls: Array.isArray(s.fotos_urls) ? s.fotos_urls : [],
        prazo_desejado: s.prazo_desejado,
        janela_horario_preferida: s.janela_horario_preferida,
        visita_janela_data_inicio: s.visita_janela_data_inicio,
        visita_janela_data_fim: s.visita_janela_data_fim,
        visita_janela_horario_inicio: s.visita_janela_horario_inicio,
        visita_janela_horario_fim: s.visita_janela_horario_fim,
        local_especifico: s.local_especifico,
        acesso_observacoes: s.acesso_observacoes,
        forma_pagamento_prevista: s.forma_pagamento_prevista,
        visita: visitaFormatada,
        cotacao: c,
        finalizacao_status: fin?.status || null,
        valor_fechado: fin?.valor_fechado_centavos ? fin.valor_fechado_centavos / 100 : (c?.valor || null),
      });
    }

    return lista;
  } catch (err) {
    console.error('[PrestadorPedidosAPI] Exceção ao listar oportunidades:', err);
    return [];
  }
}

/**
 * 2. BUSCAR DETALHES COMPLETOS DE UM PEDIDO
 */
export async function buscarDetalhesPedidoPrestador(
  solicitacaoId: string,
  prestadorId: string
): Promise<OportunidadePrestador | null> {
  if (!solicitacaoId || !prestadorId) return null;

  // 1. Prioriza a RPC oficial de detalhe com privacidade garantida no servidor
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      'obter_detalhe_pedido_prestador',
      {
        p_solicitacao_id: solicitacaoId,
        p_prestador_id: prestadorId,
      }
    );

    if (!rpcErr && rpcData) {
      const d = rpcData as any;
      const agora = new Date();
      let visitaFormatada = null;
      if (d.visita) {
        const fimV = new Date(`${d.visita.data_visita}T${d.visita.horario_fim}`);
        visitaFormatada = {
          ...d.visita,
          ja_passou: !isNaN(fimV.getTime()) && agora >= fimV,
        };
      }

      const estadoCalculado = calcularEstadoPrestador(
        d.status_prestador || 'notificado',
        visitaFormatada,
        d.cotacao,
        d.status_solicitacao || 'aberta',
        d.finalizacao_status || d.finalizacao?.status
      );

      const local = d.local || {};
      let locExibida = 'Região sob consulta';
      if (local.bairro && local.cidade) {
        locExibida = `${local.bairro}, ${local.cidade}`;
        if (local.distancia_km != null) {
          locExibida += ` • ${local.distancia_km} km`;
        }
      } else if (local.cidade) {
        locExibida = local.cidade;
      }

      return {
        id: d.solicitacao_id,
        solicitacao_id: d.solicitacao_id,
        despacho_id: d.despacho_id || '',
        prestador_id: d.prestador_id,
        status_prestador: d.status_prestador || 'notificado',
        estado_fluxo: estadoCalculado,
        notificado_em: d.notificado_em,
        respondido_em: d.respondido_em,
        data_aceite: d.data_aceite,
        prazo_limite_aceite: d.prazo_limite_aceite,
        segundos_restantes_aceite: d.segundos_restantes_aceite,
        prazo_horas_aceite: d.prazo_horas_aceite,
        eh_emergencia: d.eh_emergencia,
        cotacoes_recebidas_count: d.cotacoes_recebidas_count || 0,
        max_cotacoes: d.max_cotacoes || 3,
        titulo: d.titulo || `${d.categoria || 'Demanda'} Predial`,
        categoria: d.categoria || 'Manutenção Predial',
        descricao: d.descricao || '',
        urgencia: d.urgencia || 'normal',
        status_solicitacao: d.status_solicitacao || 'aberta',
        condominio_nome: local.aceito ? (local.condominio_nome || 'Condomínio Residencial') : 'Condomínio Residencial',
        localizacao_exibida: locExibida,
        fotos_urls: Array.isArray(d.fotos_urls) ? d.fotos_urls : [],
        prazo_desejado: d.prazo_desejado,
        janela_horario_preferida: d.janela_horario_preferida,
        visita_janela_data_inicio: d.visita_janela_data_inicio,
        visita_janela_data_fim: d.visita_janela_data_fim,
        visita_janela_horario_inicio: d.visita_janela_horario_inicio,
        visita_janela_horario_fim: d.visita_janela_horario_fim,
        local_especifico: d.local_especifico,
        acesso_observacoes: d.acesso_observacoes,
        forma_pagamento_prevista: d.forma_pagamento_prevista,
        local: {
          aceito: !!local.aceito,
          bairro: local.bairro || '',
          cidade: local.cidade || '',
          estado: local.estado || '',
          distancia_km: local.distancia_km,
          condominio_id: local.condominio_id,
          condominio_nome: local.condominio_nome,
          logradouro: local.logradouro,
          numero: local.numero,
          complemento: local.complemento,
          cep: local.cep,
          latitude: local.latitude,
          longitude: local.longitude,
          endereco_completo: local.endereco_completo,
        },
        visita: visitaFormatada,
        cotacao: d.cotacao,
      };
    }
  } catch (err) {
    console.warn('[PrestadorPedidosAPI] Falha ao consultar RPC obter_detalhe_pedido_prestador:', err);
  }

  // Fallback via lista de oportunidades
  const lista = await buscarOportunidadesPrestador(prestadorId);
  const encontrado = lista.find((item) => item.solicitacao_id === solicitacaoId);
  if (encontrado) return encontrado;

  // Se não encontrou no lote inicial, busca individualmente
  try {
    const { data: s, error: errS } = await supabase
      .from('solicitacoes')
      .select(`
        id,
        titulo,
        categoria,
        descricao,
        urgencia,
        status,
        cancelamento_motivo,
        cancelado_em,
        prazo_desejado,
        janela_horario_preferida,
        visita_janela_data_inicio,
        visita_janela_data_fim,
        visita_janela_horario_inicio,
        visita_janela_horario_fim,
        forma_pagamento_prevista,
        local_especifico,
        acesso_observacoes,
        fotos_urls,
        criado_em,
        condominio:condominios (
          id,
          nome,
          endereco
        )
      `)
      .eq('id', solicitacaoId)
      .single();

    if (errS || !s) return null;

    const { data: d } = await supabase
      .from('solicitacao_despacho')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .eq('prestador_id', prestadorId)
      .maybeSingle();

    const { data: v } = await supabase
      .from('solicitacao_visitas_tecnicas')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .eq('prestador_id', prestadorId)
      .neq('status', 'cancelada')
      .maybeSingle();

    const { data: cList } = await supabase
      .from('cotacoes')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .eq('prestador_id', prestadorId)
      .order('selecionada', { ascending: false })
      .order('criado_em', { ascending: false })
      .limit(1);

    const c = cList && cList.length > 0 ? cList[0] : null;

    const agora = new Date();
    let visitaFormatada = null;
    if (v) {
      const fimV = new Date(`${v.data_visita}T${v.horario_fim}`);
      visitaFormatada = {
        ...v,
        ja_passou: !isNaN(fimV.getTime()) && agora >= fimV,
      };
    }

    const estadoCalculado = calcularEstadoPrestador(
      d?.status_prestador || 'notificado',
      visitaFormatada,
      c,
      s.status
    );

    const condo = (s as any).condominio;
    let locExibida = 'Localização aproximada';
    if (condo?.endereco) {
      if (typeof condo.endereco === 'object') {
        const endObj = condo.endereco as any;
        const bairro = endObj.bairro || '';
        const cidade = endObj.cidade || '';
        if (bairro) {
          locExibida = `${bairro}, ${cidade || 'SP'}`;
        } else if (cidade) {
          locExibida = cidade;
        }
      } else if (typeof condo.endereco === 'string') {
        locExibida = condo.endereco;
      }
    }

    return {
      id: s.id,
      solicitacao_id: s.id,
      despacho_id: d?.id || '',
      prestador_id: prestadorId,
      status_prestador: d?.status_prestador || 'notificado',
      estado_fluxo: estadoCalculado,
      notificado_em: d?.notificado_em || s.criado_em,
      respondido_em: d?.respondido_em,
      titulo: s.titulo || `${s.categoria || 'Demanda'} Predial`,
      categoria: s.categoria || 'Manutenção Predial',
      descricao: s.descricao || '',
      urgencia: s.urgencia || 'normal',
      status_solicitacao: s.status,
      condominio_nome: condo?.nome || 'Condomínio Residencial',
      localizacao_exibida: locExibida,
      fotos_urls: Array.isArray(s.fotos_urls) ? s.fotos_urls : [],
      prazo_desejado: s.prazo_desejado,
      janela_horario_preferida: s.janela_horario_preferida,
      visita_janela_data_inicio: s.visita_janela_data_inicio,
      visita_janela_data_fim: s.visita_janela_data_fim,
      visita_janela_horario_inicio: s.visita_janela_horario_inicio,
      visita_janela_horario_fim: s.visita_janela_horario_fim,
      local_especifico: s.local_especifico,
      acesso_observacoes: s.acesso_observacoes,
      forma_pagamento_prevista: s.forma_pagamento_prevista,
      visita: visitaFormatada,
      cotacao: c,
    };
  } catch (err) {
    console.error('[PrestadorPedidosAPI] Erro ao buscar pedido por id:', err);
    return null;
  }
}

/**
 * 3. BUSCAR VISITAS EXISTENTES PARA EXIBIR SLOTS OCUPADOS
 */
export async function buscarVisitasExistentesSolicitacao(
  solicitacaoId: string
): Promise<Array<{ data_visita: string; horario_inicio: string; horario_fim: string; prestador_id: string }>> {
  try {
    const { data, error } = await supabase
      .from('solicitacao_visitas_tecnicas')
      .select('data_visita, horario_inicio, horario_fim, prestador_id, status')
      .eq('solicitacao_id', solicitacaoId)
      .neq('status', 'cancelada');

    if (error || !data) return [];
    return data;
  } catch (err) {
    console.warn('[PrestadorPedidosAPI] Erro ao carregar visitas ocupadas:', err);
    return [];
  }
}

/**
 * 4. AGENDAR VISITA TÉCNICA (ATÔMICO COM LOCK VIA RPC)
 */
export async function agendarVisitaTecnicaPrestador(params: {
  solicitacaoId: string;
  prestadorId: string;
  dataVisita: string;
  horarioInicio: string;
  horarioFim: string;
  observacoes?: string;
}): Promise<{ sucesso: boolean; visita_id?: string; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('agendar_visita_tecnica', {
      p_solicitacao_id: params.solicitacaoId,
      p_prestador_id: params.prestadorId,
      p_data_visita: params.dataVisita,
      p_horario_inicio: params.horarioInicio,
      p_horario_fim: params.horarioFim,
      p_observacoes: params.observacoes || null,
    });

    if (error) {
      if (error.code === '23505' || error.message?.includes('uq_solicitacao_slot_visita')) {
        return {
          sucesso: false,
          erro: 'Este horário já foi agendado por outro prestador para este pedido. Por favor, escolha outro slot.',
        };
      }
      return { sucesso: false, erro: error.message };
    }

    if (data && !data.sucesso) {
      return { sucesso: false, erro: data.erro || 'Falha ao agendar visita técnica.' };
    }

    return { sucesso: true, visita_id: data?.visita_id };
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Erro inesperado ao agendar visita.' };
  }
}

/**
 * 5. VERIFICAR SE O PRESTADOR PODE ENVIAR COTAÇÃO (TRAVA DE HORÁRIO DE VISITA)
 */
export async function verificarPodeEnviarCotacao(
  solicitacaoId: string,
  prestadorId: string
): Promise<{
  liberado: boolean;
  motivo: 'cotacao_direta' | 'visita_realizada' | 'visita_pendente';
  data_visita?: string;
  horario_inicio?: string;
  horario_fim?: string;
  visita_id?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('pode_prestador_enviar_cotacao', {
      p_solicitacao_id: solicitacaoId,
      p_prestador_id: prestadorId,
    });

    if (!error && data) {
      return data;
    }
  } catch (_) {}

  // Fallback client-side
  try {
    const { data: visitas } = await supabase
      .from('solicitacao_visitas_tecnicas')
      .select('id, data_visita, horario_inicio, horario_fim, status')
      .eq('solicitacao_id', solicitacaoId)
      .eq('prestador_id', prestadorId)
      .neq('status', 'cancelada')
      .order('criado_em', { ascending: false })
      .limit(1);

    if (!visitas || visitas.length === 0) {
      return { liberado: true, motivo: 'cotacao_direta' };
    }

    const v = visitas[0];
    const agora = new Date();
    const fimVisita = new Date(`${v.data_visita}T${v.horario_fim}`);

    if (isNaN(fimVisita.getTime()) || agora < fimVisita) {
      const [ano, mes, dia] = v.data_visita.split('-');
      return {
        liberado: false,
        motivo: 'visita_pendente',
        data_visita: `${dia}/${mes}/${ano}`,
        horario_inicio: v.horario_inicio.substring(0, 5),
        horario_fim: v.horario_fim.substring(0, 5),
        visita_id: v.id,
      };
    }

    return {
      liberado: true,
      motivo: 'visita_realizada',
      visita_id: v.id,
    };
  } catch (err) {
    return { liberado: true, motivo: 'cotacao_direta' };
  }
}

/**
 * 6. ENVIAR OU EDITAR COTAÇÃO COMERCIAL
 */
export async function enviarOuEditarCotacaoPrestador(params: {
  cotacaoId?: string; // Se presente, é edição
  solicitacaoId: string;
  prestadorId: string;
  despachoId?: string;
  valor: number;
  prazo_execucao_dias: number;
  observacoes?: string;
  garantia_meses?: number;
  condicoes_pagamento?: string;
  origem_cotacao?: 'direta' | 'visita_tecnica';
  visita_id?: string | null;
}): Promise<{ sucesso: boolean; cotacao_id?: string; erro?: string }> {
  try {
    const {
      cotacaoId,
      solicitacaoId,
      prestadorId,
      despachoId,
      valor,
      prazo_execucao_dias,
      observacoes,
      garantia_meses,
      condicoes_pagamento,
      origem_cotacao,
      visita_id,
    } = params;

    let obsFinal = observacoes || '';
    if (garantia_meses) {
      obsFinal += `\n\n🛡️ Garantia Técnica: ${garantia_meses} meses.`;
    }
    if (condicoes_pagamento) {
      obsFinal += `\n💳 Condições de Pagamento: ${condicoes_pagamento}`;
    }

    if (cotacaoId) {
      // Edição de proposta existente (somente se não foi aprovada)
      const { data: cotExistente, error: errGet } = await supabase
        .from('cotacoes')
        .select('id, selecionada')
        .eq('id', cotacaoId)
        .single();

      if (errGet || !cotExistente) {
        return { sucesso: false, erro: 'Proposta não encontrada.' };
      }
      if (cotExistente.selecionada) {
        return { sucesso: false, erro: 'Esta proposta já foi aprovada pelo síndico e não pode mais ser alterada.' };
      }

      const { error: updErr } = await supabase
        .from('cotacoes')
        .update({
          valor: Number(valor),
          valor_total_centavos: Math.round(Number(valor) * 100),
          prazo_execucao_dias: Number(prazo_execucao_dias) || 1,
          observacoes: obsFinal.trim(),
          garantia_meses: Number(garantia_meses) || 0,
          condicoes_pagamento: condicoes_pagamento || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', cotacaoId);

      if (updErr) {
        return { sucesso: false, erro: updErr.message };
      }

      return { sucesso: true, cotacao_id: cotacaoId };
    }

    // Inserção de nova proposta comercial
    const { data: novaCotacao, error: insertErr } = await supabase
      .from('cotacoes')
      .insert({
        solicitacao_id: solicitacaoId,
        prestador_id: prestadorId,
        valor: Number(valor),
        valor_total_centavos: Math.round(Number(valor) * 100),
        prazo_execucao_dias: Number(prazo_execucao_dias) || 1,
        observacoes: obsFinal.trim(),
        origem_cotacao: origem_cotacao || (visita_id ? 'visita_tecnica' : 'direta'),
        visita_id: visita_id || null,
        selecionada: false,
        composicao: 'valor_unico',
        material_fornecido_por: 'nao_se_aplica',
        garantia_meses: Number(garantia_meses) || 0,
        condicoes_pagamento: condicoes_pagamento || null,
      })
      .select('id')
      .single();

    if (insertErr) {
      return { sucesso: false, erro: insertErr.message };
    }

    // Atualiza status do despacho para aceito_cotar / cotacao_enviada
    const decisaoValida = ((origem_cotacao as any) === 'visita_tecnica' || (origem_cotacao as any) === 'agendou_visita') ? 'agendou_visita' : 'cotou_direto';
    try {
      if (despachoId) {
        await supabase
          .from('solicitacao_despacho')
          .update({
            status_prestador: 'aceito_cotar',
            estado_fluxo: 'cotacao_enviada',
            decisao_prestador: decisaoValida,
            decisao_em: new Date().toISOString(),
            data_aceite: new Date().toISOString(),
            respondido_em: new Date().toISOString(),
          })
          .eq('id', despachoId);
      } else {
        await supabase
          .from('solicitacao_despacho')
          .update({
            status_prestador: 'aceito_cotar',
            estado_fluxo: 'cotacao_enviada',
            decisao_prestador: decisaoValida,
            decisao_em: new Date().toISOString(),
            data_aceite: new Date().toISOString(),
            respondido_em: new Date().toISOString(),
          })
          .match({ solicitacao_id: solicitacaoId, prestador_id: prestadorId });
      }
    } catch (_) {}

    // Atualiza solicitacoes para 'cotando' se estiver aberta
    try {
      await supabase
        .from('solicitacoes')
        .update({ status: 'cotando', atualizado_em: new Date().toISOString() })
        .eq('id', solicitacaoId)
        .eq('status', 'aberta');
    } catch (_) {}

    return { sucesso: true, cotacao_id: novaCotacao?.id };
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Erro ao registrar cotação.' };
  }
}

/**
 * 7. RETIRAR COTAÇÃO (CANCELAMENTO PELO PRESTADOR)
 */
export async function retirarCotacaoPrestador(
  cotacaoId: string,
  solicitacaoId: string,
  prestadorId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    // 1. Verifica se já foi aprovada
    const { data: c, error: errC } = await supabase
      .from('cotacoes')
      .select('id, selecionada')
      .eq('id', cotacaoId)
      .eq('prestador_id', prestadorId)
      .single();

    if (errC || !c) {
      return { sucesso: false, erro: 'Proposta não encontrada.' };
    }

    if (c.selecionada) {
      return {
        sucesso: false,
        erro: 'Esta proposta já foi selecionada e homologada pelo condomínio. Não é possível retirá-la.',
      };
    }

    // 2. Exclui a cotação
    const { error: delErr } = await supabase
      .from('cotacoes')
      .delete()
      .eq('id', cotacaoId)
      .eq('prestador_id', prestadorId);

    if (delErr) {
      return { sucesso: false, erro: delErr.message };
    }

    // 3. Verifica se o prestador tem visita agendada para retornar o estado adequado
    const { data: v } = await supabase
      .from('solicitacao_visitas_tecnicas')
      .select('id')
      .eq('solicitacao_id', solicitacaoId)
      .eq('prestador_id', prestadorId)
      .neq('status', 'cancelada')
      .maybeSingle();

    const novoEstado = v ? 'visita_agendada' : 'recebido';
    await supabase
      .from('solicitacao_despacho')
      .update({
        estado_fluxo: novoEstado,
        status_prestador: v ? 'aceito_cotar' : 'visualizado',
      })
      .match({ solicitacao_id: solicitacaoId, prestador_id: prestadorId });

    return { sucesso: true };
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Erro ao retirar proposta.' };
  }
}

/**
 * 8. RECUSAR CHAMADO / PEDIDO DESPACHADO
 */

/**
 * 7.5. ACEITE ATÔMICO DE CONVITE VIA RPC (VALIDA PRAZO E COTA CHEIA NO SERVIDOR)
 */
export async function aceitarConviteDespacho(
  despachoId: string,
  prestadorId: string
): Promise<{ sucesso: boolean; codigo: string; mensagem: string }> {
  try {
    const { data, error } = await supabase.rpc('aceitar_convite_despacho', {
      p_despacho_id: despachoId,
      p_prestador_id: prestadorId,
    });

    if (error) {
      return { sucesso: false, codigo: 'ERRO_RPC', mensagem: error.message };
    }

    return (data || {
      sucesso: false,
      codigo: 'DESCONHECIDO',
      mensagem: 'Resposta inesperada do servidor.',
    }) as { sucesso: boolean; codigo: string; mensagem: string };
  } catch (err: any) {
    return {
      sucesso: false,
      codigo: 'EXCECAO',
      mensagem: err?.message || 'Falha de conexão ao aceitar convite.',
    };
  }
}

export async function recusarChamadoPrestador(params: {
  despachoId: string;
  prestadorId?: string;
  motivo: string;
  observacao?: string;
}): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { despachoId, prestadorId, motivo, observacao } = params;

    // Se temos prestadorId, executa a RPC no servidor
    if (prestadorId) {
      const { data, error } = await supabase.rpc('recusar_convite_despacho', {
        p_despacho_id: despachoId,
        p_prestador_id: prestadorId,
        p_motivo: motivo,
        p_observacao: observacao || null,
      });

      if (!error && data?.sucesso) {
        return { sucesso: true };
      }
    }

    // Fallback legado
    const { error: updErr } = await supabase
      .from('solicitacao_despacho')
      .update({
        status_prestador: 'recusado',
        estado_fluxo: 'recusado',
        respondido_em: new Date().toISOString(),
      })
      .eq('id', despachoId);

    if (updErr) {
      return { sucesso: false, erro: updErr.message };
    }

    try {
      await supabase.from('prestador_recusa_motivo').insert({
        despacho_id: despachoId,
        motivo,
        observacao: observacao?.trim() || null,
      });
    } catch (_) {}

    return { sucesso: true };
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Erro ao recusar chamado.' };
  }
}
