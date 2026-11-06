/**
 * usePushNotifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook responsável por:
 *  1. Configurar canais Android de alta prioridade (solfy_alta e solfy_emergencia)
 *  2. Obter o Expo Push Token do dispositivo físico
 *  3. Registrar a assinatura push no Supabase (push_assinaturas)
 *  4. Prevenir notificações duplicadas do sistema quando o app está aberto
 *  5. Tratar cliques nas notificações (em background e cold start) para deep linking
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { marcarNotificacaoComoLida } from '../lib/condoConfigApi';
import { sanitizeAndValidateDeepLink } from '../lib/safeDeepLink';

// ── Configuração global do handler ──────────────────────────────────────────
// Quando o app está aberto em primeiro plano, o HeadsUp interno do app cuida da exibição
// evitando notificações duplicadas da barra de status do sistema por cima do app
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false, // Suprime banner do sistema quando o app já está em foco
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: false,
      shouldShowList: true,
    }),
  });
}

// ── Tipos ───────────────────────────────────────────────────────────────────
export type PushOptions = {
  userId?: string | null;
  onNotificationTapped?: (notification: Notifications.Notification) => void;
};

// ── Configura Canais Android Padronizados ────────────────────────────────────
export async function configurarCanaisAndroid(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Remove canal legado de status se existir
  try {
    await Notifications.deleteNotificationChannelAsync('solfy_status');
  } catch {}

  // 1. solfy_urgente (Emergências, chamados críticos, segurança)
  await Notifications.setNotificationChannelAsync('solfy_urgente', {
    name: 'Emergências e Prazos Críticos',
    description: 'Alertas de alta relevância sobre chamados urgentes e segurança',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    lightColor: '#DC2626',
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // 2. solfy_alta (Canal padrão: pedidos, novas cotações, visitas)
  await Notifications.setNotificationChannelAsync('solfy_alta', {
    name: 'Notificações Importantes',
    description: 'Novas demandas, cotações recebidas, mensagens e confirmações',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lightColor: '#1E3E25',
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // 3. solfy_normal (Atualizações regulares e comunicados)
  await Notifications.setNotificationChannelAsync('solfy_normal', {
    name: 'Atualizações Gerais',
    description: 'Atualizações de status, comunicados e informativos',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    enableVibrate: true,
    enableLights: false,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // 4. solfy_silencioso (Atualizações silenciosas sem vibração)
  await Notifications.setNotificationChannelAsync('solfy_silencioso', {
    name: 'Notificações Silenciosas',
    description: 'Atualizações em segundo plano sem som ou vibração',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    enableLights: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });

  // 5. solfy_lembretes (Lembretes da Agenda: acende a tela no horário com prioridade MAX)
  await Notifications.setNotificationChannelAsync('solfy_lembretes', {
    name: 'Lembretes da Agenda',
    description: 'Alarmes e lembretes de compromissos com despertar de tela',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    lightColor: '#059669',
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// ── Helper: obtém o Expo Push Token ─────────────────────────────────────────
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  await configurarCanaisAndroid();

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      'c4ef301a-84f6-46f7-af5d-e5321eb065bb';

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    console.warn('[Push] Erro ao obter token do Expo:', error);
    return null;
  }
}

/**
 * Desregistra o push token do banco ao deslogar ou sair de todos os aparelhos
 */
export async function desregistrarPushTokenDispositivo(): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (token) {
      await supabase.from('push_assinaturas').delete().eq('push_token', token.trim());
    }
  } catch (err) {
    console.warn('[Push] Erro ao desregistrar push token do dispositivo:', err);
  }
}

// ── Hook principal ───────────────────────────────────────────────────────────
export function usePushNotifications({
  userId,
  onNotificationTapped,
}: PushOptions = {}) {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

  const registrar = useCallback(async () => {
    try {
      const token = await getExpoPushToken();
      if (!token) return;

      const plat = Platform.OS === 'ios' ? 'ios' : 'android';
      const disp = `${Device.brand || ''} ${Device.modelName || ''}`.trim() || Platform.OS;

      // 1. Tenta registrar na nova tabela unificada push_assinaturas via RPC
      const { error: rpcError } = await supabase.rpc('registrar_push_assinatura', {
        p_plataforma: plat,
        p_push_token: token.trim(),
        p_dispositivo: disp,
      });

      if (rpcError) {
        // Fallback para a RPC anterior se a migration ainda não foi rodada no banco
        try {
          await supabase.rpc('registrar_dispositivo_push', {
            p_push_token: token.trim(),
            p_plataforma: plat,
            p_dispositivo_curto: disp,
          });
        } catch {}
      }
    } catch (err) {
      console.warn('[Push] Erro ao registrar dispositivo:', err);
    }
  }, []);

  const handleDeepLink = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as any;
      if (!data) return;

      const notifId = data.id || data.notificacao_id;
      if (notifId) {
        marcarNotificacaoComoLida(notifId).catch(() => {});
      }

      const targetUrl = data.url || data.acao_url;
      if (targetUrl) {
        // Validação estrita de segurança: apenas rotas internas permitidas e com UUID válido
        const safeUrl = sanitizeAndValidateDeepLink(targetUrl);
        if (safeUrl) {
          try {
            router.push(safeUrl as any);
          } catch {
            router.push('/(app)/notificacoes');
          }
        } else {
          router.push('/(app)/notificacoes');
        }
      }
    },
    [router]
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;

    registrar();

    // 1. Trata clique na notificação quando o app já estava em segundo plano
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleDeepLink(response);
        onNotificationTapped?.(response.notification);
      }
    );

    // 2. Trata cold start (quando o app estava 100% fechado e foi aberto pelo clique na notificação)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleDeepLink(response);
        onNotificationTapped?.(response.notification);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId, registrar, handleDeepLink, onNotificationTapped]);

  return { registrar };
}

export default usePushNotifications;
