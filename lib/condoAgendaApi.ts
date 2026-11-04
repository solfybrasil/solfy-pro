import { supabase } from './supabase';
import type { NotificacaoItem } from './condoConfigApi';

export interface AgendaCompromissoItem {
  id: string;
  condominio_id: string;
  condominio_nome?: string | null;
  solicitacao_id?: string | null;
  visita_id?: string | null;
  tipo: 'visita_tecnica' | 'execucao_obra' | 'vistoria' | 'outro';
  titulo: string;
  descricao?: string | null;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;   // YYYY-MM-DD
  horario_inicio: string; // HH:mm
  horario_fim: string;   // HH:mm
  status: 'agendado' | 'confirmado' | 'em_andamento' | 'concluido' | 'cancelado';
  prestador_id?: string | null;
  prestador_nome?: string | null;
  prestador_telefone?: string | null;
  prestador_foto?: string | null;
  local_especifico?: string | null;
  solicitacao_titulo?: string | null;
  confirmada_sindico_em?: string | null;
  observacoes?: string | null;
}

/**
 * Busca compromissos da agenda com suporte a fallback gracioso
 * caso a tabela 'agenda_compromissos' não tenha sido migrada ainda.
 */
let agendaCompromissosDisponivel = true;

export async function listarCompromissosAgenda(params: {
  condominioId?: string;
  prestadorId?: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<AgendaCompromissoItem[]> {
  const { condominioId, prestadorId, dataInicio, dataFim } = params;

  if (agendaCompromissosDisponivel) {
    try {
      // 1. Tentar ler da tabela unificada 'agenda_compromissos'
      let query = supabase
        .from('agenda_compromissos')
        .select(`
          id,
          condominio_id,
          solicitacao_id,
          visita_id,
          tipo,
          titulo,
          descricao,
          data_compromisso,
          horario_inicio,
          horario_fim,
          status,
          prestador_id,
          solicitacao:solicitacoes (
            id,
            titulo,
            local_especifico
          ),
          prestador:prestadores (
            id,
            name,
            phone,
            foto_perfil_url
          )
        `)
        .order('data_compromisso', { ascending: true })
        .order('horario_inicio', { ascending: true });

      if (condominioId) {
        query = query.eq('condominio_id', condominioId);
      }
      if (prestadorId) {
        query = query.eq('prestador_id', prestadorId);
      }
      if (dataInicio) {
        query = query.gte('data_compromisso', dataInicio);
      }
      if (dataFim) {
        query = query.lte('data_compromisso', dataFim);
      }

      // Por padrão na agenda, nunca exibe compromissos cancelados
      query = query.neq('status', 'cancelado');

      const { data, error } = await query;

      if (error) {
        agendaCompromissosDisponivel = false;
      } else if (data && data.length > 0) {
        // Cruzamento de segurança: se o prestador já enviou cotação para o pedido,
        // a visita técnica foi superada e não deve constar na agenda.
        const solicitacaoIds = Array.from(new Set(data.map((item: any) => item.solicitacao_id).filter(Boolean)));
        let cotacoesExistentes: { solicitacao_id: string; prestador_id: string }[] = [];

        if (solicitacaoIds.length > 0) {
          try {
            const { data: cots } = await supabase
              .from('cotacoes')
              .select('solicitacao_id, prestador_id')
              .in('solicitacao_id', solicitacaoIds);
            if (cots) cotacoesExistentes = cots;
          } catch (_) {}
        }

        const cotacaoChaves = new Set(
          cotacoesExistentes.map((c) => `${c.solicitacao_id}_${c.prestador_id}`)
        );

        // Auto-cura e filtragem
        const itensValidos = data.filter((item: any) => {
          const chave = `${item.solicitacao_id}_${item.prestador_id}`;
          if (cotacaoChaves.has(chave)) {
            if (item.visita_id) {
              supabase
                .from('solicitacao_visitas_tecnicas')
                .update({ status: 'cancelada', observacoes: 'Cancelada automaticamente: cotação já enviada.' })
                .eq('id', item.visita_id)
                .then(() => {});
              supabase
                .from('agenda_compromissos')
                .update({ status: 'cancelado' })
                .eq('visita_id', item.visita_id)
                .then(() => {});
            }
            return false;
          }
          return true;
        });

        return itensValidos.map((item: any) => ({
          id: item.id,
          condominio_id: item.condominio_id,
          solicitacao_id: item.solicitacao_id,
          visita_id: item.visita_id,
          tipo: item.tipo,
          titulo: item.titulo,
          descricao: item.descricao,
          data_inicio: item.data_compromisso || item.data_inicio,
          data_fim: item.data_compromisso || item.data_fim,
          horario_inicio: (item.horario_inicio || '').slice(0, 5),
          horario_fim: (item.horario_fim || '').slice(0, 5),
          status: item.status,
          prestador_id: item.prestador_id,
          prestador_nome: item.prestador?.name || null,
          prestador_telefone: item.prestador?.phone || null,
          prestador_foto: item.prestador?.foto_perfil_url || null,
          local_especifico: item.solicitacao?.local_especifico || null,
          solicitacao_titulo: item.solicitacao?.titulo || null,
          observacoes: item.descricao || null,
        }));
      }
    } catch (err) {
      agendaCompromissosDisponivel = false;
    }
  }

  // 2. Fallback: Buscar direto de solicitacao_visitas_tecnicas
  try {
    let queryFallback = supabase
      .from('solicitacao_visitas_tecnicas')
      .select(`
        id,
        solicitacao_id,
        prestador_id,
        data_visita,
        horario_inicio,
        horario_fim,
        status,
        confirmada_sindico_em,
        confirmada_sindico_por,
        observacoes,
        solicitacao:solicitacoes (
          id,
          condominio_id,
          titulo,
          local_especifico
        ),
        prestador:prestadores (
          id,
          name,
          phone,
          foto_perfil_url
        )
      `)
      .neq('status', 'cancelada')
      .order('data_visita', { ascending: true })
      .order('horario_inicio', { ascending: true });

    if (prestadorId) {
      queryFallback = queryFallback.eq('prestador_id', prestadorId);
    }
    if (dataInicio) {
      queryFallback = queryFallback.gte('data_visita', dataInicio);
    }
    if (dataFim) {
      queryFallback = queryFallback.lte('data_visita', dataFim);
    }

    const { data: visitasFallback, error: errFallback } = await queryFallback;
    if (errFallback || !visitasFallback) {
      return [];
    }

    // Filtrar por condominioId se fornecido
    const filtradas = condominioId
      ? visitasFallback.filter((v: any) => v.solicitacao?.condominio_id === condominioId)
      : visitasFallback;

    // Checa cotações para eliminar visitas superadas no fallback
    const solIds = Array.from(new Set(filtradas.map((v: any) => v.solicitacao_id).filter(Boolean)));
    let cotacoesExistentes: { solicitacao_id: string; prestador_id: string }[] = [];
    if (solIds.length > 0) {
      try {
        const { data: cots } = await supabase
          .from('cotacoes')
          .select('solicitacao_id, prestador_id')
          .in('solicitacao_id', solIds);
        if (cots) cotacoesExistentes = cots;
      } catch (_) {}
    }
    const cotChaves = new Set(cotacoesExistentes.map((c) => `${c.solicitacao_id}_${c.prestador_id}`));

    const visitasSemCotacao = filtradas.filter((v: any) => {
      const chave = `${v.solicitacao_id}_${v.prestador_id}`;
      if (cotChaves.has(chave)) {
        supabase
          .from('solicitacao_visitas_tecnicas')
          .update({ status: 'cancelada', observacoes: 'Cancelada automaticamente: cotação já enviada.' })
          .eq('id', v.id)
          .then(() => {});
        return false;
      }
      return true;
    });

    return visitasSemCotacao.map((v: any) => {
      const statusMap: Record<string, AgendaCompromissoItem['status']> = {
        agendada: 'agendado',
        confirmada_sindico: 'confirmado',
        realizada: 'concluido',
        cancelada: 'cancelado',
      };

      const prestadorNome = v.prestador?.name || 'Prestador';
      const titulo = `Visita Técnica - ${v.solicitacao?.titulo || 'Demanda'} (${prestadorNome})`;

      return {
        id: `visita-${v.id}`,
        condominio_id: v.solicitacao?.condominio_id || '',
        solicitacao_id: v.solicitacao_id,
        visita_id: v.id,
        tipo: 'visita_tecnica' as const,
        titulo,
        descricao: v.observacoes || 'Visita técnica para avaliação orçamentária.',
        data_inicio: v.data_visita,
        data_fim: v.data_visita,
        horario_inicio: (v.horario_inicio || '').slice(0, 5),
        horario_fim: (v.horario_fim || '').slice(0, 5),
        status: statusMap[v.status] || 'agendado',
        prestador_id: v.prestador_id,
        prestador_nome: v.prestador?.name || null,
        prestador_telefone: v.prestador?.phone || null,
        prestador_foto: v.prestador?.foto_perfil_url || null,
        local_especifico: v.solicitacao?.local_especifico || null,
        solicitacao_titulo: v.solicitacao?.titulo || null,
        confirmada_sindico_em: v.confirmada_sindico_em,
        observacoes: v.observacoes,
      };
    });
  } catch (err) {
    console.error('[CondoAgendaAPI] Erro ao carregar compromissos de visita:', err);
    return [];
  }
}

/**
 * Confirmação rápida pelo síndico diretamente na agenda
 */
export async function confirmarVisitaPelaAgenda(
  visitaId: string,
  sindicoId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Tentar RPC oficial
    const { error: rpcError } = await supabase.rpc('confirmar_visita_sindico', {
      p_visita_id: visitaId,
      p_sindico_id: sindicoId,
    });

    if (!rpcError) {
      return { ok: true };
    }

    // 2. Se a RPC não estiver disponível, faz update direto na tabela de visitas
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('solicitacao_visitas_tecnicas')
      .update({
        status: 'confirmada_sindico',
        confirmada_sindico_em: nowIso,
        confirmada_sindico_por: sindicoId,
      })
      .eq('id', visitaId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    // Tentar atualizar em agenda_compromissos se existir
    await supabase
      .from('agenda_compromissos')
      .update({
        status: 'confirmado',
        atualizado_em: nowIso,
      })
      .eq('visita_id', visitaId);

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao confirmar visita' };
  }
}

/**
 * Cancelar ou solicitar reagendamento de uma visita pela agenda
 */
export async function cancelarVisitaPelaAgenda(
  visitaId: string,
  motivo?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const nowIso = new Date().toISOString();

    const { error: visitError } = await supabase
      .from('solicitacao_visitas_tecnicas')
      .update({
        status: 'cancelada',
        observacoes: motivo ? `Cancelada/Reagendamento solicitado: ${motivo}` : undefined,
      })
      .eq('id', visitaId);

    if (visitError) {
      return { ok: false, error: visitError.message };
    }

    // Atualizar agenda_compromissos se existir
    await supabase
      .from('agenda_compromissos')
      .update({
        status: 'cancelado',
        atualizado_em: nowIso,
      })
      .eq('visita_id', visitaId);

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao cancelar visita' };
  }
}

/**
 * Disparador de lembretes automáticos devidos
 */
export async function processarLembretesDevidos(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('processar_lembretes_agenda');
    if (error) {
      return 0;
    }
    return typeof data === 'number' ? data : 0;
  } catch {
    return 0;
  }
}

export interface NovoCompromissoPayload {
  condominio_id?: string;
  tipo: 'visita_tecnica' | 'execucao_obra' | 'vistoria' | 'outro';
  titulo: string;
  descricao?: string;
  data_compromisso: string; // YYYY-MM-DD
  horario_inicio: string;   // HH:mm
  horario_fim: string;     // HH:mm
  local_especifico?: string;
  prestador_id?: string | null;
  prestador_nome?: string | null;
  solicitacao_id?: string | null;
}

/**
 * Salva um novo compromisso na tabela agenda_compromissos e registra notificação
 */
export async function agendarNovoCompromisso(
  payload: NovoCompromissoPayload
): Promise<{ ok: boolean; compromisso?: AgendaCompromissoItem; notificacao?: NotificacaoItem; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Se o condomínio for mock ou não for UUID válido, trata como null para evitar erro de sintaxe UUID no Postgres
    const isUuid = (val?: string | null) =>
      val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const safeCondominioId = isUuid(payload.condominio_id) ? payload.condominio_id : null;
    const safePrestadorId = isUuid(payload.prestador_id) ? payload.prestador_id : null;
    const safeSolicitacaoId = isUuid(payload.solicitacao_id) ? payload.solicitacao_id : null;

    const rowToInsert: Record<string, any> = {
      tipo: payload.tipo,
      titulo: payload.titulo,
      descricao: payload.descricao || null,
      data_compromisso: payload.data_compromisso,
      horario_inicio: payload.horario_inicio.length === 5 ? `${payload.horario_inicio}:00` : payload.horario_inicio,
      horario_fim: payload.horario_fim.length === 5 ? `${payload.horario_fim}:00` : payload.horario_fim,
      status: 'agendado',
      local_endereco: payload.local_especifico || null,
      sindico_user_id: userId || null,
      condominio_id: safeCondominioId,
      prestador_id: safePrestadorId,
      solicitacao_id: safeSolicitacaoId,
      atualizado_em: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase
      .from('agenda_compromissos')
      .insert(rowToInsert)
      .select()
      .single();

    if (insertError) {
      console.error('[agendarNovoCompromisso] Erro ao inserir agenda_compromissos:', insertError);
      return { ok: false, error: insertError.message };
    }

    const item: AgendaCompromissoItem = {
      id: inserted.id,
      condominio_id: inserted.condominio_id || payload.condominio_id || 'condo',
      solicitacao_id: inserted.solicitacao_id,
      visita_id: inserted.visita_id,
      tipo: inserted.tipo,
      titulo: inserted.titulo,
      descricao: inserted.descricao,
      data_inicio: inserted.data_compromisso,
      data_fim: inserted.data_compromisso,
      horario_inicio: (inserted.horario_inicio || '').slice(0, 5),
      horario_fim: (inserted.horario_fim || '').slice(0, 5),
      status: inserted.status,
      prestador_id: inserted.prestador_id,
      prestador_nome: payload.prestador_nome || null,
      local_especifico: inserted.local_endereco,
      solicitacao_titulo: payload.titulo,
    };

    // Cria notificação correspondente para o usuário
    let notifItem: NotificacaoItem | undefined;
    if (userId) {
      try {
        const { data: notifData } = await supabase
          .from('notificacoes')
          .insert({
            user_id: userId,
            condominio_id: safeCondominioId,
            titulo: `📅 ${payload.tipo === 'visita_tecnica' ? 'Visita Técnica' : 'Compromisso'}: ${payload.titulo}`,
            corpo: `Agendado para ${payload.data_compromisso} às ${payload.horario_inicio}${payload.local_especifico ? ` (${payload.local_especifico})` : ''}.`,
            tipo: 'agenda',
            categoria: 'visitas_execucao',
            canal: 'app',
            prioridade: 'normal',
            acao_url: '/(app)/agenda',
            lida: false,
          })
          .select()
          .single();

        if (notifData) {
          notifItem = {
            id: notifData.id,
            user_id: notifData.user_id,
            condominio_id: notifData.condominio_id,
            titulo: notifData.titulo,
            corpo: notifData.corpo,
            tipo: notifData.tipo,
            categoria: notifData.categoria,
            canal: notifData.canal,
            prioridade: notifData.prioridade,
            acao_url: notifData.acao_url,
            lida: false,
            criado_em: notifData.criado_em,
            criado_em_fmt: 'agora',
          };
        }
      } catch (e) {
        console.warn('[agendarNovoCompromisso] Notificação:', e);
      }
    }

    return { ok: true, compromisso: item, notificacao: notifItem };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro inesperado ao salvar compromisso' };
  }
}
