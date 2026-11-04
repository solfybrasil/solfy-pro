import * as React from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  marcarNotificacaoComoLida,
  listarNotificacoesCentral,
  type NotificacaoItem,
} from '../lib/condoConfigApi';
import { HeadsUpNotification } from '../components/HeadsUpNotification';
import { registrarServiceWorkerWeb } from '../lib/webPushService';
import { tocarSomNotificacao } from '../lib/notificationSound';

const STORAGE_LAST_SEEN_KEY = '@solfy_pro:notif_last_seen_at';

interface NotificationContextType {
  naoLidasTotal: number;
  ultimoAvisoTimestamp: number;
  recarregarContador: () => Promise<void>;
  enfileirarNotificacao: (notif: NotificacaoItem) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  naoLidasTotal: 0,
  ultimoAvisoTimestamp: 0,
  recarregarContador: async () => {},
  enfileirarNotificacao: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const [naoLidasTotal, setNaoLidasTotal] = useState(0);
  const [ultimoAvisoTimestamp, setUltimoAvisoTimestamp] = useState(0);
  const [fila, setFila] = useState<NotificacaoItem[]>([]);
  const notifAtiva = fila.length > 0 ? fila[0] : null;

  // Cache em memória para deduplicação absoluta por ID
  const exibidasIdsRef = useRef<Set<string>>(new Set());
  const segmentsRef = useRef<string[]>(segments);
  segmentsRef.current = segments;

  // Atualiza badge no ícone do app
  const atualizarAppBadge = useCallback((total: number) => {
    setNaoLidasTotal(total);
    if (Platform.OS !== 'web') {
      Notifications.setBadgeCountAsync(total).catch(() => {});
    } else if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      try {
        if (total > 0) {
          (navigator as any).setAppBadge(total).catch(() => {});
        } else {
          (navigator as any).clearAppBadge().catch(() => {});
        }
      } catch {}
    }
  }, []);

  // Busca contador real de não lidas
  const recarregarContador = useCallback(async () => {
    if (!user?.id) return;
    try {
      // 1. Busca direta de contagem não-lida (rápida e sem depender de RPC)
      const { count, error } = await supabase
        .from('notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('lida', false);

      if (!error && typeof count === 'number') {
        atualizarAppBadge(count);
        return;
      }

      // 2. Fallback via RPC da central
      const res = await listarNotificacoesCentral(1, 0);
      atualizarAppBadge(res.dados.total_nao_lidas);
    } catch {}
  }, [user?.id, atualizarAppBadge]);

  // Enfileira nova notificação respeitando deduplicação e filtro de tela ativa
  const enfileirarNotificacao = useCallback(
    (notif: NotificacaoItem) => {
      if (!notif?.id) return;

      // Deduplicação: se já foi mostrada ou está na fila, descarta
      if (exibidasIdsRef.current.has(notif.id)) {
        return;
      }
      exibidasIdsRef.current.add(notif.id);

      // Limita tamanho do histórico de IDs para não consumir memória infinita
      if (exibidasIdsRef.current.size > 200) {
        const arr = Array.from(exibidasIdsRef.current);
        exibidasIdsRef.current = new Set(arr.slice(arr.length - 100));
      }

      // Toca o som oficial Solfy e notifica o sininho
      tocarSomNotificacao().catch(() => {});
      setUltimoAvisoTimestamp(Date.now());

      // Regra de Não-Perturbe: Não exibe se o usuário já estiver na mesma tela/chat
      const curSegments = segmentsRef.current;
      const rotaAtual = curSegments.join('/');
      const acaoUrl = notif.acao_url || '';

      if (acaoUrl && rotaAtual) {
        const cleanAcao = acaoUrl.replace(/^\/(app|auth)\//, '').replace(/^\//, '');
        const cleanRota = rotaAtual.replace(/^\(app\)\//, '').replace(/^\(auth\)\//, '');
        if (cleanAcao !== '' && cleanAcao !== 'notificacoes' && cleanRota.includes(cleanAcao)) {
          // Usuário já está na tela do chamado ou do chat: apenas incrementa contador e não pisca pop-up
          setNaoLidasTotal((prev) => prev + 1);
          return;
        }
      }

      // Se a fila passar de 3 notificações, agrupa a próxima
      setFila((prev) => {
        if (prev.length >= 3) {
          const agrupada: NotificacaoItem = {
            id: `agrupada-${Date.now()}`,
            categoria: 'comunicados_solfy',
            tipo: 'sistema',
            titulo: 'Novas Notificações',
            corpo: `Você tem ${prev.length + 1} novas notificações no condomínio.`,
            lida: false,
            canal: 'app',
            prioridade: 'normal',
            acao_url: '/(app)/notificacoes',
            criado_em: new Date().toISOString(),
            criado_em_fmt: 'agora',
          };
          return [prev[0], agrupada];
        }
        return [...prev, notif];
      });

      setNaoLidasTotal((prev) => prev + 1);
    },
    []
  );

  // Dispensar da fila atual
  const handleDismiss = useCallback(() => {
    setFila((prev) => prev.slice(1));
  }, []);

  // Toque na notificação Heads-Up: navega e marca como lida
  const handlePress = useCallback(
    async (notif: NotificacaoItem) => {
      handleDismiss();

      // Marca como lida no servidor
      if (notif.id && !notif.id.startsWith('agrupada-')) {
        marcarNotificacaoComoLida(notif.id).catch(() => {});
        setNaoLidasTotal((prev) => Math.max(0, prev - 1));
      }

      // Deep link para a tela correta
      const targetUrl = notif.acao_url || '/(app)/notificacoes';
      try {
        router.push(targetUrl as any);
      } catch {
        router.push('/(app)/notificacoes');
      }
    },
    [handleDismiss, router]
  );

  // ─── CANAL REALTIME ÚNICO POR SESSÃO ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setFila([]);
      setNaoLidasTotal(0);
      return;
    }

    // 1. Carrega dados iniciais e recupera notificações perdidas
    recarregarContador();

    // Registra Service Worker no ambiente Web para receber push e postMessage
    if (Platform.OS === 'web') {
      registrarServiceWorkerWeb((notif) => enfileirarNotificacao(notif));
    }

    // 2. Cria canal global único no Supabase Realtime
    const canalNome = `realtime_notificacoes_user_${user.id}`;
    const canal = supabase
      .channel(canalNome)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row) {
            const notifItem: NotificacaoItem = {
              id: row.id,
              condominio_id: row.condominio_id,
              categoria: row.categoria || 'comunicados_solfy',
              tipo: row.tipo || 'sistema',
              titulo: row.titulo || 'Nova Notificação',
              corpo: row.corpo || row.mensagem || '',
              lida: Boolean(row.lida),
              canal: row.canal || 'app',
              prioridade: row.prioridade || 'normal',
              acao_url: row.acao_url || row.link || '/(app)/notificacoes',
              criado_em: row.criado_em || new Date().toISOString(),
              criado_em_fmt: 'agora',
            };
            enfileirarNotificacao(notifItem);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Atualiza timestamp da última visualização ativa
          AsyncStorage.setItem(STORAGE_LAST_SEEN_KEY, new Date().toISOString()).catch(() => {});
        }
      });

    // ─── RECONEXÃO E RECUPERAÇÃO DE EVENTOS PERDIDOS ─────────────────────────
    // Quando o aparelho volta do background ou a internet é restabelecida
    const recuperarPerdidas = async () => {
      try {
        const lastSeen = await AsyncStorage.getItem(STORAGE_LAST_SEEN_KEY);
        const agoraIso = new Date().toISOString();
        await AsyncStorage.setItem(STORAGE_LAST_SEEN_KEY, agoraIso);

        let query = supabase
          .from('notificacoes')
          .select('*')
          .eq('user_id', user.id)
          .eq('lida', false)
          .order('criado_em', { ascending: false })
          .limit(10);

        if (lastSeen) {
          query = query.gt('criado_em', lastSeen);
        }

        const { data: perdidas } = await query;
        if (perdidas && perdidas.length > 0) {
          // Adiciona as que não foram exibidas
          for (const row of perdidas) {
            if (!exibidasIdsRef.current.has(row.id)) {
              enfileirarNotificacao({
                id: row.id,
                condominio_id: row.condominio_id,
                categoria: row.categoria || 'comunicados_solfy',
                tipo: row.tipo || 'sistema',
                titulo: row.titulo,
                corpo: row.corpo || row.mensagem || '',
                lida: false,
                canal: row.canal || 'app',
                prioridade: row.prioridade || 'normal',
                acao_url: row.acao_url || row.link || '/(app)/notificacoes',
                criado_em: row.criado_em,
                criado_em_fmt: 'agora',
              });
            }
          }
        }
        recarregarContador();
      } catch (e) {
        console.warn('[NotificationContext] Erro ao sincronizar perdas:', e);
      }
    };

    // Monitora retorno ao primeiro plano (Foreground)
    const subAppState = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        recuperarPerdidas();
      }
    });

    // Monitora reconexão de rede
    const subNetInfo = NetInfo.addEventListener((netState: NetInfoState) => {
      if (netState.isConnected) {
        recuperarPerdidas();
      }
    });

    // 3. Polling de fallback a cada 8 segundos quando o app está em primeiro plano
    // Garante que notificações cheguem mesmo sob quedas pontuais de websocket ou reconexão
    const pollingInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        recuperarPerdidas();
      }
    }, 8000);

    return () => {
      subAppState.remove();
      subNetInfo();
      clearInterval(pollingInterval);
      supabase.removeChannel(canal).catch(() => {});
    };
  }, [user?.id, enfileirarNotificacao, recarregarContador]);

  const contextValue = useMemo(
    () => ({
      naoLidasTotal,
      ultimoAvisoTimestamp,
      recarregarContador,
      enfileirarNotificacao,
    }),
    [naoLidasTotal, ultimoAvisoTimestamp, recarregarContador, enfileirarNotificacao]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {/* HeadsUp Notification montada globalmente uma única vez na raiz */}
      {notifAtiva && (
        <HeadsUpNotification
          notification={notifAtiva}
          countInQueue={fila.length}
          onPress={handlePress}
          onDismiss={handleDismiss}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

export const useNotification = useNotifications;

export default NotificationProvider;
