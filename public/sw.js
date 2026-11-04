/**
 * public/sw.js  —  Service Worker PWA / Web Push Solfy
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsável por receber Web Push em segundo plano, deduplicar notificações
 * quando o navegador já estiver aberto e gerenciar cliques de deep link.
 * ─────────────────────────────────────────────────────────────────────────────
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Recebimento de Push ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      titulo: 'Solfy Condo',
      corpo: event.data ? event.data.text() : 'Você tem uma nova notificação',
    };
  }

  const {
    id,
    notificacao_id,
    titulo = 'Solfy Condo',
    corpo = 'Você tem uma nova notificação',
    acao_url = '/(app)/notificacoes',
    prioridade = 'normal',
    categoria = 'comunicados_solfy',
  } = payload;

  const notifId = id || notificacao_id || `solfy-${Date.now()}`;
  const ehEmergencia = prioridade === 'urgente' || prioridade === 'emergencia';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Verifica se existe alguma janela do Solfy aberta e em foco/visível
      const janelaVisivel = clientList.find(
        (client) => client.visibilityState === 'visible' || client.focused
      );

      if (janelaVisivel) {
        // Se a janela estiver aberta e visível, NÃO mostra notificação do sistema
        // Envia mensagem para o frontend exibir o pop-up HeadsUp suave dentro do app
        janelaVisivel.postMessage({
          type: 'SOLFY_HEADSUP_NOTIFICATION',
          notificacao: {
            id: notifId,
            titulo,
            corpo,
            acao_url,
            prioridade,
            categoria,
            criado_em: new Date().toISOString(),
          },
        });
        return;
      }

      // 2. Se o app estiver em segundo plano ou fechado, exibe notificação nativa do sistema
      const options = {
        body: corpo,
        icon: '/assets/images/logo.png',
        badge: '/assets/images/notification-icon.png',
        tag: notifId,
        renotify: false,
        requireInteraction: ehEmergencia,
        data: {
          url: acao_url,
          id: notifId,
        },
      };

      return self.registration.showNotification(titulo, options);
    })
  );
});

// ── Clique na Notificação ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já houver uma janela aberta, foca nela e navega
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Se não houver, abre uma nova janela no endereço alvo
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
