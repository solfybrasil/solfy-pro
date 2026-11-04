import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────
// Tipos de eventos suportados
// ─────────────────────────────────────────────────────────────
export type LogEventType =
  | 'app_opened'
  | 'login'
  | 'logout'
  | 'order_reported'
  | 'order_accepted'
  | 'order_rejected'
  | 'order_completed'
  | 'status_online'
  | 'status_offline'
  | 'profile_updated'
  | 'map_viewed'
  | 'limit_reached'
  | 'error';

export interface LogMetadata {
  order_id?: string;
  category?: string;
  price?: number;
  final_price?: number;
  city?: string;
  description?: string;
  message?: string;
  screen?: string;
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────
export function useLogger(helperId: string | null | undefined) {
  // Ref para evitar múltiplos logs idênticos em sequência
  const lastEvent = useRef<string>('');

  const log = useCallback(
    async (eventType: LogEventType, metadata: LogMetadata = {}) => {
      if (!helperId) return;

      // Deduplicação simples: não loga o mesmo evento 2x seguidos dentro de 2s
      const eventKey = `${eventType}-${JSON.stringify(metadata)}`;
      if (eventKey === lastEvent.current) return;
      lastEvent.current = eventKey;
      setTimeout(() => { lastEvent.current = ''; }, 2000);

      try {
        await supabase.from('helper_logs').insert({
          helper_id: helperId,
          event_type: eventType,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (err) {
        // Silent fail — logs não devem quebrar o fluxo do app
        console.warn('[Logger] Falha ao registrar evento:', eventType, err);
      }
    },
    [helperId]
  );

  return { log };
}

// ─────────────────────────────────────────────────────────────
// Função standalone (para usar fora de componentes React)
// ─────────────────────────────────────────────────────────────
export async function logEvent(
  helperId: string,
  eventType: LogEventType,
  metadata: LogMetadata = {}
) {
  if (!helperId) return;
  try {
    await supabase.from('helper_logs').insert({
      helper_id: helperId,
      event_type: eventType,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn('[Logger] Falha ao registrar evento:', eventType, err);
  }
}
