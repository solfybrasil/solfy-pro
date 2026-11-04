import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const COINS_PER_ORDER = 3;

export function useSolfCoin(helperId: string | undefined) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!helperId) return;
    try {
      const { data } = await supabase
        .from('solfcoin_wallets')
        .select('balance')
        .eq('helper_id', helperId)
        .maybeSingle();
      setBalance(data?.balance ?? 0);
    } catch (e) {
      console.error('[SolfCoin] fetchBalance error:', e);
      setBalance(0);
    }
  }, [helperId]);

  /** Debita COINS_PER_ORDER moedas para desbloquear um pedido.
   *  Retorna true se bem-sucedido, false se saldo insuficiente. */
  const debitForOrder = useCallback(async (orderId: string): Promise<boolean> => {
    if (!helperId) return false;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('debit_solfcoins', {
        p_helper_id: helperId,
        p_amount: COINS_PER_ORDER,
        p_reason: 'unlock_order',
        p_reference: orderId,
      });
      if (error) throw error;
      if (data === true) {
        // Atualiza saldo local
        setBalance(prev => (prev !== null ? prev - COINS_PER_ORDER : null));
        return true;
      }
      return false; // saldo insuficiente
    } catch (e) {
      console.error('[SolfCoin] debitForOrder error:', e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [helperId]);

  /** Estorna COINS_PER_ORDER moedas caso o aceite do pedido falhe. */
  const refundForOrder = useCallback(async (orderId: string): Promise<void> => {
    if (!helperId) return;
    try {
      await supabase.rpc('credit_solfcoins', {
        p_helper_id: helperId,
        p_amount: COINS_PER_ORDER,
        p_reason: 'refund_failed_order',
        p_reference: orderId,
      });
      // Atualiza saldo local
      setBalance(prev => (prev !== null ? prev + COINS_PER_ORDER : null));
    } catch (e) {
      console.error('[SolfCoin] refundForOrder error:', e);
    }
  }, [helperId]);

  return { balance, loading, fetchBalance, debitForOrder, refundForOrder };
}
