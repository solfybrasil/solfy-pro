import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function registrarServiceWorkerWeb(onMessageReceived?: (notif: any) => void): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[WebPush] Service Worker registrado com sucesso');

    // Escuta mensagens enviadas pelo Service Worker (ex: HeadsUp quando a aba está em foco)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SOLFY_HEADSUP_NOTIFICATION' && event.data.notificacao) {
        onMessageReceived?.(event.data.notificacao);
      }
    });

    // Se o usuário já tiver permissão concedida, sincroniza a assinatura
    if ('Notification' in window && Notification.permission === 'granted') {
      await sincronizarAssinaturaWebPush(registration);
    }
  } catch (err) {
    console.warn('[WebPush] Falha ao registrar Service Worker:', err);
  }
}

export async function solicitarPermissaoWebPush(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      await sincronizarAssinaturaWebPush(reg);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[WebPush] Erro ao solicitar permissão:', err);
    return false;
  }
}

async function sincronizarAssinaturaWebPush(registration: ServiceWorkerRegistration): Promise<void> {
  try {
    const existing = await registration.pushManager.getSubscription();
    if (!existing) return;

    const raw = existing.toJSON();
    const endpoint = raw.endpoint;
    const p256dh = raw.keys?.p256dh;
    const authKey = raw.keys?.auth;

    if (endpoint) {
      try {
        await supabase.rpc('registrar_push_assinatura', {
          p_plataforma: 'web',
          p_endpoint: endpoint,
          p_p256dh: p256dh || null,
          p_auth_key: authKey || null,
          p_dispositivo: 'Navegador Web',
          p_user_agent: navigator.userAgent,
        });
      } catch {}
    }
  } catch (e) {
    console.warn('[WebPush] Erro ao sincronizar assinatura:', e);
  }
}
