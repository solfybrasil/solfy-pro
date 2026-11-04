/**
 * notificationService.ts
 * Gerencia notificações do prestador:
 * - Notificação persistente "Online" na barra de status
 * - Heads-Up Notification de novo pedido (aparece sobre outros apps)
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { configurarCanaisAndroid } from '../hooks/usePushNotifications';

// IDs padronizados de canais
const ORDER_CHANNEL_ID = 'solfy_alta';
const EMERGENCY_CHANNEL_ID = 'solfy_urgente';

/**
 * Configura os canais de notificação Android padronizados.
 * O setNotificationHandler global reside exclusivamente em usePushNotifications.ts.
 */
export async function setupNotifications(): Promise<boolean> {
  await configurarCanaisAndroid();
  return true;
}

/**
 * Solicita permissão de notificação ao usuário.
 * Retorna true se concedida.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
      allowCriticalAlerts: true,
    },
  });
  return status === 'granted';
}

/**
 * Notificação fixa "Online" foi descartada da arquitetura (solfy_status removido).
 * Mantido como no-op seguro para evitar quebras em chamadas legadas.
 */
export async function showOnlineNotification(): Promise<void> {
  return;
}

export async function dismissOnlineNotification(): Promise<void> {
  return;
}

/**
 * Exibe uma Heads-Up Notification de novo pedido.
 * Aparece sobre qualquer app aberto no Android com prioridade MAX e na Web via Web Notifications API.
 */
export async function showOrderHeadsUpNotification(order: {
  id: string;
  category?: string;
  price?: number;
  city?: string;
  distance?: string;
}): Promise<string> {
  const title = `🔔 Novo pedido: ${order.category || 'Serviço Geral'}`;
  const body = [
    order.price ? `R$ ${order.price}` : null,
    order.city,
    order.distance,
  ].filter(Boolean).join(' • ') || 'Toque para ver detalhes';

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          const n = new Notification(title, {
            body,
            icon: '/assets/images/logo.png',
            tag: `order-${order.id}`,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
          };
        } catch (e) {
          console.warn('[Web Notification Error]', e);
        }
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            try {
              new Notification(title, { body, tag: `order-${order.id}` });
            } catch (_) {}
          }
        });
      }
    }
    return `web-${Date.now()}`;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 250, 200, 250, 200, 250],
      data: {
        type: 'new_order',
        orderId: order.id,
      },
      ...(Platform.OS === 'android' && {
        channelId: ORDER_CHANNEL_ID,
        color: '#F59E0B',
        smallIcon: 'notification_icon',
        actions: [
          { identifier: 'VIEW', title: '▶ Ver Pedido', opensAppToForeground: true },
          { identifier: 'DISMISS', title: 'Dispensar', isDestructive: true, opensAppToForeground: false },
        ],
      }),
    },
    trigger: null,
  });

  return id;
}

/**
 * Cancela uma notificação de pedido específica.
 */
export async function dismissOrderNotification(notificationId: string): Promise<void> {
  if (!notificationId || Platform.OS === 'web') return;
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (_) {}
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

/**
 * Cancela TODAS as notificações ativas.
 */
export async function dismissAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.dismissAllNotificationsAsync();
}
