import { supabase } from './supabase';

export interface StatusPilula {
  tipo: 'fatura_vencida' | 'fatura_a_vencer' | 'documento_pendente' | 'pausado' | 'em_dia';
  texto: string;
  cor: 'vermelho' | 'ambar' | 'cinza' | 'verde';
  rota: string | null;
}

export interface ResumoPedidos {
  oportunidades: {
    total: number;
    mais_urgente_segundos: number | null;
    texto_urgencia: string;
  };
  demandas: {
    em_andamento: number;
    fechadas: number;
  };
  proxima_visita: {
    agendada: boolean;
    data_formatada: string | null;
    hora_formatada: string | null;
    bairro: string | null;
    resumo: string;
    solicitacao_id: string | null;
  };
}

export interface ResumoFinanceiro {
  situacao: 'em_dia' | 'aberta' | 'vencida';
  valor_total: number;
  valor_formatado: string;
  dias_vencimento: number | null;
  dias_atraso: number | null;
  vencimento_formatado: string | null;
  cobranca_id: string | null;
  pix_copia_cola: string | null;
  pix_qrcode_base64: string | null;
  invoice_url: string | null;
  texto_linha: string;
  texto_apoio: string | null;
}

export interface PrestadorResumoHome {
  status_pilula: StatusPilula;
  pedidos: ResumoPedidos;
  financeiro: ResumoFinanceiro;
}

/**
 * Busca o resumo consolidado do Card Principal da Home do Prestador.
 * Toda a regra de priorização, contagens e financeiro é resolvida
 * pelo servidor na RPC public.prestador_resumo_home.
 */
export async function buscarResumoHomePrestador(
  prestadorId: string
): Promise<PrestadorResumoHome | null> {
  if (!prestadorId) return null;

  try {
    const { data, error } = await supabase.rpc('prestador_resumo_home', {
      p_prestador_id: prestadorId,
    });

    if (error) {
      console.warn('[prestadorHomeApi] Erro na RPC prestador_resumo_home:', error);
      throw error;
    }

    return (data as PrestadorResumoHome) || null;
  } catch (err) {
    console.error('[prestadorHomeApi] Exceção ao buscar resumo da home:', err);
    throw err;
  }
}
