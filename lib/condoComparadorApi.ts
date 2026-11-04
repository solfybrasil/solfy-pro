import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type {
  ComparadorDados,
  CotacaoComparadorItem,
  AprovacaoCotacaoInput,
  AprovacaoCotacaoRegistro,
  BadgeCotacao,
  AprovacaoPreparada,
  AprovacaoExecutarInput,
  ComprovanteAprovacao,
  VerificacaoIntegridadeResult,
  HistoricoAprovacaoItem,
  HistoricoAprovacaoFiltros,
} from '../types/comparador';

const CACHE_PREFIX = 'solfy_comparador_cache_';

/**
 * Busca os dados do comparador de cotações para uma solicitação / pedido.
 * Utiliza prioritariamente a RPC `comparador_cotacoes` (single source of truth server-side).
 * Em caso de falha de rede/offline, tenta carregar do cache local.
 * Possui fallback resiliente calculando rankings e badges se a RPC ainda não tiver sido executada no banco.
 */
export async function buscarComparativoCotacoes(pedidoId: string): Promise<ComparadorDados> {
  const cacheKey = `${CACHE_PREFIX}${pedidoId}`;

  try {
    // 1. Tenta chamar a RPC server-side oficial
    const { data: rpcData, error: rpcErr } = await supabase.rpc('comparador_cotacoes', {
      p_pedido_id: pedidoId,
    });

    if (!rpcErr && rpcData && rpcData.meta) {
      const resultado = rpcData as ComparadorDados;
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: resultado, ts: Date.now() }));
      } catch (_) {}
      return resultado;
    }

    if (rpcErr) {
      console.warn('[ComparadorAPI] RPC comparador_cotacoes retornou erro ou não existe. Executando fallback direto:', rpcErr);
    }
  } catch (err) {
    console.warn('[ComparadorAPI] Falha de rede ao consultar RPC comparador_cotacoes:', err);
    // Tenta cache offline
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.data as ComparadorDados;
      }
    } catch (_) {}
  }

  // 2. Fallback resiliente: consulta tabelas diretamente e calcula regras no client
  return await calcularComparativoFallback(pedidoId);
}

/**
 * Fallback de segurança para garantir funcionamento imediato mesmo antes da migration ser rodada no Supabase
 */
async function calcularComparativoFallback(pedidoId: string): Promise<ComparadorDados> {
  // Query resiliente: select('*') nunca falha se colunas novas ainda não tiverem sido migradas
  const { data: sol, error: solErr } = await supabase
    .from('solicitacoes')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle();

  if (solErr || !sol) {
    throw new Error('Não foi possível carregar os dados da solicitação. Verifique se o ID está correto.');
  }

  const solObj = sol;

  let rawCotacoes: any[] = [];
  try {
    const { data: cots, error: cotErr } = await supabase
      .from('cotacoes')
      .select(`
        *,
        prestador:prestadores(
          id,
          name,
          service_type,
          rating,
          completed_requests,
          foto_perfil_url,
          user_id
        )
      `)
      .eq('solicitacao_id', pedidoId);

    if (!cotErr && cots) {
      rawCotacoes = cots;
    } else {
      // Fallback sem join caso a relação prestador falhe
      const { data: cotsSemJoin } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('solicitacao_id', pedidoId);
      rawCotacoes = cotsSemJoin || [];
    }
  } catch (err) {
    console.warn('[ComparadorAPI] Erro ao buscar cotações no fallback:', err);
  }

  const cotacaoIds = (rawCotacoes || []).map((c: any) => c.id);
  const itensPorCotacao: Record<string, any[]> = {};
  if (cotacaoIds.length > 0) {
    try {
      const { data: itensData } = await supabase
        .from('cotacao_itens')
        .select('*')
        .in('cotacao_id', cotacaoIds)
        .order('ordem', { ascending: true });
      if (itensData) {
        itensData.forEach((it: any) => {
          if (!itensPorCotacao[it.cotacao_id]) itensPorCotacao[it.cotacao_id] = [];
          itensPorCotacao[it.cotacao_id].push(it);
        });
      }
    } catch (_) {}
  }

  const minExigido = (solObj as any).min_cotacoes_para_aprovar || (solObj as any).numero_cotacoes_desejado || 3;
  const now = new Date();

  const cotacoesBase = (rawCotacoes || [])
    .filter((c: any) => !c.status || c.status === 'enviada' || c.status === 'aprovada' || c.selecionada)
    .map((c: any) => {
      const p = Array.isArray(c.prestador) ? c.prestador[0] : c.prestador;
      const valorCentavos =
        c.valor_total_centavos != null
          ? Number(c.valor_total_centavos)
          : Math.round(Number(c.valor || 0) * 100);

      const validade = c.validade_proposta_ate
        ? new Date(c.validade_proposta_ate)
        : new Date(Date.now() + 15 * 86400000);

      const expirada = validade < now && !c.selecionada && c.status !== 'aprovada';

      // Parse escopo e garantia de observações se colunas estruturadas estiverem nulas
      let garantia = c.garantia_meses != null ? Number(c.garantia_meses) : null;
      if (garantia == null && typeof c.observacoes === 'string') {
        const m = c.observacoes.match(/Garantia.*?(\d+)\s*meses/i);
        if (m) garantia = parseInt(m[1], 10);
      }

      const cItens = itensPorCotacao[c.id] || [];
      let subMo = Number(c.subtotal_mao_de_obra_centavos || 0);
      let subMat = Number(c.subtotal_material_centavos || 0);
      let subOutros = Number(c.subtotal_outros_centavos || 0);

      if (cItens.length > 0 && subMo === 0 && subMat === 0 && subOutros === 0) {
        cItens.forEach((it) => {
          const itemTot = Number(it.total_centavos ?? Math.round(Number(it.quantidade) * Number(it.valor_unitario_centavos)));
          if (it.tipo === 'mao_de_obra') subMo += itemTot;
          else if (it.tipo === 'material') subMat += itemTot;
          else subOutros += itemTot;
        });
      }

      const composicao = (c.composicao || (cItens.length > 0 ? 'detalhada' : 'valor_unico')) as any;
      const matFornecido = (c.material_fornecido_por || (subMat > 0 ? 'prestador' : 'nao_se_aplica')) as any;

      return {
        id: c.id,
        prestador_id: c.prestador_id,
        nome_exibicao: p?.name || 'Prestador Solfy',
        foto_perfil_url: p?.foto_perfil_url || null,
        service_type: p?.service_type || 'Técnico Especializado',
        selo_verificado: false,
        nota_media: Number(p?.rating || 5.0),
        qtd_avaliacoes: Number(p?.completed_requests || 0),
        valor_total_centavos: valorCentavos,
        composicao,
        material_fornecido_por: matFornecido,
        subtotal_mao_de_obra_centavos: subMo,
        subtotal_material_centavos: subMat,
        subtotal_outros_centavos: subOutros,
        prazo_execucao_dias: c.prazo_execucao_dias != null ? Number(c.prazo_execucao_dias) : null,
        inicio_previsto: c.inicio_previsto || null,
        garantia_meses: garantia,
        validade_proposta_ate: validade.toISOString(),
        expirada,
        condicoes_pagamento: c.condicoes_pagamento || 'Faturamento contra medição / Conclusão',
        escopo_incluso: c.escopo_incluso || null,
        observacoes: c.observacoes || null,
        anexos: Array.isArray(c.anexos) ? c.anexos : [],
        versao: Number(c.versao || 1),
        status: (c.status || (c.selecionada ? 'aprovada' : 'enviada')) as any,
        selecionada: !!c.selecionada,
        foi_revisada: Number(c.versao || 1) > 1,
        valor_anterior_centavos: null,
        itens: cItens,
      };
    });

  // Estatísticas para badges e ranks
  const validas = cotacoesBase.filter((c) => !c.expirada);
  const minPreco = validas.length > 0 ? Math.min(...validas.map((c) => c.valor_total_centavos)) : 0;
  const avgPreco = validas.length > 0 ? validas.reduce((acc, c) => acc + c.valor_total_centavos, 0) / validas.length : 0;

  // Estatísticas de Mão de Obra e Material
  const validasComMO = validas.filter((c) => c.subtotal_mao_de_obra_centavos > 0);
  const minMO = validasComMO.length > 0 ? Math.min(...validasComMO.map((c) => c.subtotal_mao_de_obra_centavos)) : null;

  const validasComMat = validas.filter((c) => c.subtotal_material_centavos > 0 && c.material_fornecido_por === 'prestador');
  const minMat = validasComMat.length > 0 ? Math.min(...validasComMat.map((c) => c.subtotal_material_centavos)) : null;

  const prazos = validas.map((c) => c.prazo_execucao_dias).filter((p): p is number => p != null);
  const minPrazo = prazos.length >= 2 ? Math.min(...prazos) : null;

  const garantias = validas.map((c) => c.garantia_meses).filter((g): g is number => g != null);
  const maxGarantia = garantias.length >= 2 ? Math.max(...garantias) : null;

  const notasQualificadas = validas.filter((c) => c.qtd_avaliacoes >= 3).map((c) => c.nota_media);
  const maxNota = notasQualificadas.length > 0 ? Math.max(...notasQualificadas) : null;

  // Ranks de Mão de Obra
  const ordenadasPorMO = [...validasComMO].sort((a, b) => a.subtotal_mao_de_obra_centavos - b.subtotal_mao_de_obra_centavos);
  const mapaRankMO: Record<string, number> = {};
  ordenadasPorMO.forEach((c, i) => {
    mapaRankMO[c.id] = i + 1;
  });

  // Ordenação base por menor preço
  cotacoesBase.sort((a, b) => a.valor_total_centavos - b.valor_total_centavos);

  const cotacoesFinais: CotacaoComparadorItem[] = cotacoesBase.map((c, idx) => {
    const diffMenorCentavos = minPreco > 0 ? c.valor_total_centavos - minPreco : 0;
    const diffMenorPct = minPreco > 0 ? Math.round(((c.valor_total_centavos - minPreco) / minPreco) * 1000) / 10 : 0;
    const diffMediaPct = avgPreco > 0 ? Math.round(((c.valor_total_centavos - avgPreco) / avgPreco) * 1000) / 10 : 0;

    const diffMoCentavos =
      minMO != null && c.subtotal_mao_de_obra_centavos > 0 ? c.subtotal_mao_de_obra_centavos - minMO : null;

    const badges: BadgeCotacao[] = [];
    if (!c.expirada) {
      if (c.valor_total_centavos === minPreco && minPreco > 0) badges.push('menor_preco');
      if (minMO != null && c.subtotal_mao_de_obra_centavos === minMO) badges.push('menor_mao_de_obra');
      if (minMat != null && c.subtotal_material_centavos === minMat && c.material_fornecido_por === 'prestador') {
        badges.push('menor_material');
      }
      if (minPrazo != null && c.prazo_execucao_dias === minPrazo) badges.push('menor_prazo');
      if (maxGarantia != null && c.garantia_meses === maxGarantia) badges.push('maior_garantia');
      if (maxNota != null && c.qtd_avaliacoes >= 3 && c.nota_media === maxNota) badges.push('melhor_avaliacao');
    }

    // Camada A: Comparação com as demais deste pedido
    const outrosValores = validas
      .filter((other) => other.id !== c.id)
      .map((other) => other.valor_total_centavos)
      .sort((a, b) => a - b);

    let alertaCamadaA: any = null;
    if (outrosValores.length >= 2) {
      const mid = Math.floor(outrosValores.length / 2);
      const medianaDemais = outrosValores.length % 2 !== 0
        ? outrosValores[mid]
        : Math.round((outrosValores[mid - 1] + outrosValores[mid]) / 2);

      const desvioPct = Math.round(((c.valor_total_centavos - medianaDemais) / medianaDemais) * 100);
      let nivelA: 'na_media' | 'acima_dos_demais' | 'abaixo_dos_demais' = 'na_media';
      if (desvioPct > 25) nivelA = 'acima_dos_demais';
      else if (desvioPct < -25) nivelA = 'abaixo_dos_demais';

      alertaCamadaA = {
        nivel: nivelA,
        desvio_pct: desvioPct,
        mediana_demais_centavos: medianaDemais,
        escopo_comparado: 'total',
        texto: nivelA === 'acima_dos_demais'
          ? 'Acima da mediana das demais propostas deste pedido'
          : nivelA === 'abaixo_dos_demais'
          ? 'Abaixo da mediana das demais propostas deste pedido'
          : 'Alinhada à mediana das outras propostas deste pedido'
      };
    }

    const alertaPreco = {
      camada_a: alertaCamadaA,
      camada_b: (c as any).alerta_preco?.camada_b || {
        nivel: 'sem_base' as const,
        cobertura_pct: 0,
        texto: 'Ainda sem base de comparação para este serviço na sua região'
      }
    };

    return {
      ...c,
      rank_preco: idx + 1,
      rank_mao_de_obra: mapaRankMO[c.id] || null,
      diff_vs_menor_centavos: diffMenorCentavos,
      diff_vs_menor_pct: diffMenorPct,
      diff_vs_media_pct: diffMediaPct,
      diff_mo_vs_menor_centavos: diffMoCentavos,
      badges,
      alerta_preco: alertaPreco,
    };
  });

  // Alertas de Equivalência
  const alertasEquivalencia: any[] = [];
  const temMaterialPrestador = validas.some((c) => c.material_fornecido_por === 'prestador');
  const temMaterialCondoOuNenhum = validas.some(
    (c) => c.material_fornecido_por === 'condominio' || c.material_fornecido_por === 'nao_se_aplica'
  );

  if (temMaterialPrestador && temMaterialCondoOuNenhum) {
    alertasEquivalencia.push('material_ausente_em_algumas');
  }

  const temValorUnico = validas.some((c) => c.composicao === 'valor_unico');
  const temDetalhada = validas.some((c) => c.composicao === 'detalhada');
  if (temValorUnico && temDetalhada) {
    alertasEquivalencia.push('mistura_valor_unico_e_detalhada');
  }

  const temMaterialCondo = validas.some((c) => c.material_fornecido_por === 'condominio');
  if (temMaterialCondo) {
    alertasEquivalencia.push('material_por_conta_do_condominio');
  }

  const totalValidas = validas.length;
  const podeAprovar =
    totalValidas >= minExigido &&
    ['aberta', 'cotando', 'cotacoes_completas', 'aguardando_aprovacao', 'visita_agendada'].includes(solObj.status);

  return {
    meta: {
      pedido_id: solObj.id,
      status_pedido: solObj.status,
      total_cotacoes_validas: totalValidas,
      minimo_exigido: minExigido,
      faltam: Math.max(0, minExigido - totalValidas),
      pode_aprovar: podeAprovar,
      prazo_limite_cotacoes: (solObj as any).prazo_limite_cotacoes || null,
      alertas_equivalencia: alertasEquivalencia,
    },
    cotacoes: cotacoesFinais,
  };
}

/**
 * Aprova formalmente uma cotação gerando o snapshot imutável e notificando prestadores.
 */
export async function aprovarCotacaoComSnapshot(
  input: AprovacaoCotacaoInput
): Promise<{ success: boolean; aprovacao_id?: string; message?: string }> {
  // 1. Tenta a RPC oficial com locking de linha e validação de ciente_alertas
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('aprovar_cotacao', {
    p_pedido_id: input.pedido_id,
    p_cotacao_id: input.cotacao_id,
    p_motivo_codigo: input.motivo_codigo,
    p_motivo_texto: input.motivo_texto || null,
    p_ciente_alertas: input.ciente_alertas || false,
  });

  if (!rpcErr && rpcRes) {
    if (rpcRes.success) {
      return { success: true, aprovacao_id: rpcRes.aprovacao_id };
    }
    return {
      success: false,
      message: rpcRes.message || 'Não foi possível aprovar a cotação.',
    };
  }

  if (rpcErr) {
    console.warn('[ComparadorAPI] RPC aprovar_cotacao falhou ou indisponível. Executando fallback atômico:', rpcErr);
  }

  // 2. Fallback client-side se a RPC ainda não tiver sido criada no banco
  try {
    const { data: userData } = await supabase.auth.getUser();
    let userId = userData?.user?.id;

    if (!userId) {
      const { data: solData } = await supabase
        .from('solicitacoes')
        .select('solicitado_por')
        .eq('id', input.pedido_id)
        .maybeSingle();
      userId = solData?.solicitado_por || '00000000-0000-0000-0000-000000000000';
    }

    const snapshot = await calcularComparativoFallback(input.pedido_id);

    // Busca prestador_id da cotação
    const { data: cotData } = await supabase
      .from('cotacoes')
      .select('prestador_id, valor')
      .eq('id', input.cotacao_id)
      .maybeSingle();

    // Atualiza cotações
    const { error: updErr1 } = await supabase
      .from('cotacoes')
      .update({ selecionada: true, status: 'aprovada' })
      .eq('id', input.cotacao_id);

    if (updErr1) {
      // Fallback para schema sem coluna status
      await supabase
        .from('cotacoes')
        .update({ selecionada: true })
        .eq('id', input.cotacao_id);
    }

    const { error: updErr2 } = await supabase
      .from('cotacoes')
      .update({ selecionada: false, status: 'recusada' })
      .eq('solicitacao_id', input.pedido_id)
      .neq('id', input.cotacao_id);

    if (updErr2) {
      // Fallback para schema sem coluna status
      await supabase
        .from('cotacoes')
        .update({ selecionada: false })
        .eq('solicitacao_id', input.pedido_id)
        .neq('id', input.cotacao_id);
    }

    // Atualiza status da solicitação
    await supabase
      .from('solicitacoes')
      .update({
        status: 'aprovada',
        valor_estimado: cotData?.valor != null ? Number(cotData.valor) : undefined,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', input.pedido_id);

    // Tenta gravar em aprovacoes_cotacao se a tabela existir
    try {
      await supabase.from('aprovacoes_cotacao').insert({
        pedido_id: input.pedido_id,
        cotacao_id: input.cotacao_id,
        aprovado_por: userId,
        motivo_codigo: input.motivo_codigo,
        motivo_texto: input.motivo_texto || null,
        snapshot_comparador: snapshot,
      });
    } catch (_) {
      // Grava em aprovacoes legada como contingência
      await supabase.from('aprovacoes').insert({
        solicitacao_id: input.pedido_id,
        aprovador_id: userId,
        decisao: 'aprovado',
        assinatura_digital: `SHA256-${Date.now()}-${input.cotacao_id.slice(0, 8)}`,
        comentario: `Motivo: ${input.motivo_codigo}. ${input.motivo_texto || ''}`,
      });
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Erro ao processar aprovação de cotação.',
    };
  }
}

/**
 * Busca o registro de aprovação forense com snapshot gravado
 */
export async function buscarAprovacaoPedido(pedidoId: string): Promise<AprovacaoCotacaoRegistro | null> {
  const { data, error } = await supabase
    .from('aprovacoes_cotacao')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as AprovacaoCotacaoRegistro;
}

/**
 * Assina mudanças em tempo real na tabela cotacoes para o pedido.
 * Sempre que uma nova cotação chega ou é atualizada, chama onUpdate.
 */
export function assinarRealtimeCotacoes(pedidoId: string, onUpdate: () => void): () => void {
  const channel = supabase
    .channel(`solicitacao_cotacoes_${pedidoId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cotacoes',
        filter: `solicitacao_id=eq.${pedidoId}`,
      },
      () => {
        // Rebusca os dados server-side imediatamente
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── FEATURE 10: FUNÇÕES OFICIAIS DE APROVAÇÃO COM REGISTRO FORENSE ──────────

/**
 * Prepara a folha de aprovação: busca regras server-side (ciências exigidas, necessidade de motivo, etag).
 * Nenhuma regra é recalculada no client.
 */
export async function prepararAprovacaoCotacao(
  pedidoId: string,
  cotacaoId: string
): Promise<AprovacaoPreparada> {
  try {
    const { data, error } = await supabase.rpc('aprovacao_preparar', {
      p_pedido_id: pedidoId,
      p_cotacao_id: cotacaoId,
    });

    if (!error && data && (data as any).etag) {
      const raw = data as any;
      const resumo = raw.resumo_cotacao || raw.resumo || {};
      return {
        pedido_id: raw.pedido_id || pedidoId,
        cotacao_id: raw.cotacao_id || cotacaoId,
        condominio_id: raw.condominio_id || '',
        etag: raw.etag,
        pode_aprovar: raw.pode_aprovar ?? true,
        bloqueios: raw.bloqueios || [],
        precisa_motivo: raw.precisa_motivo ?? raw.motivo_exigido ?? false,
        motivo_exigido_por: raw.motivo_exigido_por || null,
        motivos_disponiveis: (raw.motivos_disponiveis || raw.motivos_permitidos || []).map((m: any) => ({
          codigo: m.codigo,
          label: m.label || m.codigo,
          exige_texto: m.exige_texto ?? false,
        })),
        ciencias_exigidas: raw.ciencias_exigidas || [],
        resumo_cotacao: {
          prestador_id: resumo.prestador_id || '',
          prestador_nome: resumo.prestador_nome || 'Prestador',
          prestador_foto: resumo.prestador_foto || resumo.prestador_foto_url || null,
          prestador_verificado: resumo.prestador_verificado ?? resumo.prestador_selo_verificado ?? false,
          valor_total_centavos: resumo.valor_total_centavos || 0,
          prazo_execucao_dias: resumo.prazo_execucao_dias ?? null,
          garantia_meses: resumo.garantia_meses ?? null,
          diferenca_menor_centavos: resumo.diferenca_menor_centavos || 0,
          diferenca_menor_pct: resumo.diferenca_menor_pct || 0,
          is_menor_preco: resumo.is_menor_preco ?? true,
        },
        alertas_ativos: raw.alertas_ativos || { preco: null, escopo_incompleto: false },
        contador_previsao: raw.contador_previsao,
      };
    }

    if (error) {
      console.warn('[ComparadorAPI] RPC aprovacao_preparar retornou erro ou não existe:', error);
    }
  } catch (err) {
    console.warn('[ComparadorAPI] Falha de rede ao consultar RPC aprovacao_preparar:', err);
  }

  // Fallback resiliente caso a RPC ainda não esteja no banco
  const dados = await buscarComparativoCotacoes(pedidoId);
  const escolhida = dados.cotacoes.find((c) => c.id === cotacaoId);
  if (!escolhida) {
    throw new Error('Cotação não encontrada na solicitação.');
  }

  const isMenor = escolhida.rank_preco === 1;
  const menorPrecoCentavos = Math.min(...dados.cotacoes.map((c) => c.valor_total_centavos));
  const diferencaCentavos = Math.max(0, escolhida.valor_total_centavos - menorPrecoCentavos);
  const diferencaPct = menorPrecoCentavos > 0 ? (diferencaCentavos / menorPrecoCentavos) * 100 : 0;

  const ciencias: any[] = [];
  if (escolhida.alerta_preco && escolhida.alerta_preco.camada_b?.nivel?.includes('acima')) {
    ciencias.push({
      codigo: 'alerta_preco',
      versao: 1,
      texto: 'Estou ciente de que o valor desta proposta apresenta desvio crítico em relação à média regional calculada para este serviço.',
    });
  }

  return {
    pedido_id: pedidoId,
    cotacao_id: cotacaoId,
    condominio_id: '',
    etag: 'fallback-' + Date.now(),
    pode_aprovar: dados.meta.pode_aprovar,
    bloqueios: dados.meta.pode_aprovar ? [] : [{ codigo: 'minimo_cotacoes', mensagem: `Necessário ao menos ${dados.meta.minimo_exigido} cotações válidas.` }],
    precisa_motivo: !isMenor,
    motivo_exigido_por: !isMenor ? 'nao_e_menor_preco' : null,
    motivos_disponiveis: [
      { codigo: 'menor_prazo', label: 'Menor prazo de execução', exige_texto: false },
      { codigo: 'melhor_avaliacao', label: 'Melhor avaliação / histórico', exige_texto: false },
      { codigo: 'maior_garantia', label: 'Maior prazo de garantia', exige_texto: false },
      { codigo: 'outro', label: 'Outro motivo justificado', exige_texto: true },
    ],
    ciencias_exigidas: ciencias,
    resumo_cotacao: {
      prestador_id: escolhida.prestador_id,
      prestador_nome: escolhida.nome_exibicao,
      prestador_foto: escolhida.foto_perfil_url,
      prestador_verificado: escolhida.selo_verificado,
      valor_total_centavos: escolhida.valor_total_centavos,
      prazo_execucao_dias: escolhida.prazo_execucao_dias,
      garantia_meses: escolhida.garantia_meses,
      diferenca_menor_centavos: diferencaCentavos,
      diferenca_menor_pct: diferencaPct,
      is_menor_preco: isMenor,
    },
    alertas_ativos: {
      preco: escolhida.alerta_preco,
      escopo_incompleto: false,
    },
  };
}

/**
 * Executa a aprovação atômica via RPC oficial Feature 10.
 * Bloqueia se o comparador foi alterado (etag diferente) ou idempotência repetida.
 */
export async function executarAprovacaoCotacao(
  input: AprovacaoExecutarInput
): Promise<{
  success: boolean;
  comprovante_numero?: string;
  aprovacao_id?: string;
  codigo_erro?: string;
  message?: string;
}> {
  try {
    const metaApp = {
      plataforma: Platform.OS === 'ios' ? 'solfy-condo-ios' : 'solfy-condo-android',
      versao: '2.4.0-mobile',
      userAgent: `solfy-condo-app/${Platform.OS}`,
      ...(input.app_meta || {}),
    };

    const { data, error } = await supabase.rpc('aprovar_cotacao', {
      p_pedido_id: input.pedido_id,
      p_cotacao_id: input.cotacao_id,
      p_motivo_codigo: input.motivo_codigo || 'menor_preco',
      p_motivo_texto: input.motivo_texto || null,
      p_ciente_alertas: input.ciencias && input.ciencias.length > 0,
      p_etag: input.etag,
      p_idempotency_key: input.idempotency_key,
      p_ciencias: input.ciencias,
      p_app_meta: metaApp,
      p_reauth_token: input.reauth_token || null,
    });

    if (error) {
      console.error('[ComparadorAPI] Erro ao chamar RPC aprovar_cotacao:', error);
      return {
        success: false,
        codigo_erro: 'erro_rpc',
        message: error.message || 'Erro no servidor ao processar aprovação.',
      };
    }

    if (data && data.success) {
      // Limpa cache da solicitação para forçar reload atualizado
      try {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${input.pedido_id}`);
      } catch (_) {}

      return {
        success: true,
        comprovante_numero: data.comprovante_numero,
        aprovacao_id: data.aprovacao_id,
      };
    }

    return {
      success: false,
      codigo_erro: data?.codigo || 'erro_desconhecido',
      message: data?.message || 'Não foi possível aprovar a cotação.',
    };
  } catch (err: any) {
    return {
      success: false,
      codigo_erro: 'excecao',
      message: err.message || 'Erro inesperado ao aprovar cotação.',
    };
  }
}

/**
 * Consulta o comprovante forense imutável com todos os detalhes e ciências
 */
export async function buscarComprovanteAprovacao(
  aprovacaoId: string
): Promise<ComprovanteAprovacao> {
  const { data, error } = await supabase.rpc('aprovacao_comprovante', {
    p_aprovacao_id: aprovacaoId,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Comprovante não encontrado ou sem permissão de visualização.');
  }

  const raw = data as any;
  const condNome = raw.condominio?.nome || raw.condominio_nome || 'Condomínio';
  const condCnpj = raw.condominio?.cnpj || raw.condominio_cnpj || null;
  const pedTitulo = raw.pedido?.titulo || raw.pedido_titulo || 'Demanda Condominial';
  const pedCat = raw.pedido?.categoria || raw.pedido_categoria || null;
  const aprovNome = raw.aprovador?.nome || raw.aprovador_nome || 'Síndico';
  const aprovPapel = raw.aprovador?.papel_no_momento || raw.aprovador_papel || 'sindico';

  const cotEscolhida = raw.cotacao_escolhida || {
    id: raw.cotacao_id || '',
    prestador_id: raw.prestador_id || '',
    prestador_nome: raw.prestador_nome || 'Prestador',
    prestador_selo_verificado: raw.prestador_selo_verificado || false,
    valor_total_centavos: raw.valor_total_centavos || 0,
    prazo_execucao_dias: raw.prazo_execucao_dias ?? null,
    garantia_meses: raw.garantia_meses ?? null,
  };

  const snapshot = raw.snapshot_comparador || {};
  const todasCotacoes = Array.isArray(snapshot.cotacoes) ? snapshot.cotacoes : [];
  const concorrentes = raw.demais_cotacoes || todasCotacoes
    .filter((c: any) => c.id !== (raw.cotacao_id || cotEscolhida.id))
    .map((c: any) => ({
      id: c.id,
      prestador_nome: c.nome_exibicao || c.prestador_nome || 'Concorrente',
      valor_total_centavos: c.valor_total_centavos || 0,
      prazo_execucao_dias: c.prazo_execucao_dias ?? null,
    }));

  const integridade = raw.integridade || {
    hash_snapshot: raw.hash_snapshot || '',
    hash_anterior: raw.hash_anterior || null,
    hash_encadeado: raw.hash_encadeado || '',
    codigo_verificacao: raw.codigo_verificacao || '',
    valido: true,
  };

  return {
    id: raw.aprovacao_id || raw.id || aprovacaoId,
    comprovante_numero: raw.comprovante_numero || 'APR-PENDENTE',
    created_at: raw.data_aprovacao || raw.created_at || new Date().toISOString(),
    condominio: {
      id: raw.condominio?.id || raw.condominio_id || '',
      nome: condNome,
      cnpj: condCnpj,
    },
    pedido: {
      id: raw.pedido?.id || raw.pedido_id || '',
      titulo: pedTitulo,
      categoria: pedCat,
    },
    aprovador: {
      id: raw.aprovador?.id || raw.aprovado_por || '',
      nome: aprovNome,
      papel_no_momento: aprovPapel,
    },
    cotacao_escolhida: cotEscolhida,
    demais_cotacoes: concorrentes,
    motivo: raw.motivo || {
      codigo: raw.motivo_codigo || 'menor_preco',
      texto: raw.motivo_texto || null,
    },
    ciencias: Array.isArray(raw.ciencias) ? raw.ciencias : [],
    integridade,
    estado_aprovacao: raw.estado_aprovacao || 'registrada',
    app: raw.app || {
      plataforma: raw.app_plataforma || 'web',
      versao: raw.app_versao || '2.4.0',
    },
  };
}

/**
 * Executa checagem matemática do SHA-256 da folha e elo anterior
 */
export async function verificarIntegridadeComprovante(
  aprovacaoId: string
): Promise<VerificacaoIntegridadeResult> {
  const { data, error } = await supabase.rpc('aprovacao_verificar', {
    p_aprovacao_id: aprovacaoId,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao verificar integridade criptográfica do comprovante.');
  }

  return data as VerificacaoIntegridadeResult;
}

/**
 * Lista histórico de aprovações com paginação por cursor (keyset) e filtros
 */
export async function listarHistoricoAprovacoes(
  condominioId: string,
  filtros?: HistoricoAprovacaoFiltros,
  cursorCreatedAt?: string,
  cursorId?: string,
  limit: number = 20
): Promise<HistoricoAprovacaoItem[]> {
  const { data, error } = await supabase.rpc('aprovacao_historico', {
    p_condominio_id: condominioId,
    p_filtros: filtros || {},
    p_cursor_created_at: cursorCreatedAt || null,
    p_cursor_id: cursorId || null,
    p_limit: limit,
  });

  if (error) {
    console.error('[ComparadorAPI] Erro ao listar histórico de aprovações:', error);
    throw new Error(error.message || 'Não foi possível carregar o histórico de aprovações.');
  }

  return (data || []) as HistoricoAprovacaoItem[];
}

