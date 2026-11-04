import * as React from 'react';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronRight } from 'lucide-react-native';
import type { NotificacaoItem } from '../lib/condoConfigApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = Math.min(SCREEN_WIDTH - 24, 420);

export interface HeadsUpNotificationProps {
  notification: NotificacaoItem | null;
  countInQueue?: number;
  onPress: (notif: NotificacaoItem) => void;
  onDismiss: () => void;
}

export function HeadsUpNotification({
  notification,
  countInQueue = 0,
  onPress,
  onDismiss,
}: HeadsUpNotificationProps) {
  const insets = useSafeAreaInsets();
  const [tempoRelativo, setTempoRelativo] = useState('agora');
  const timerRef = useRef<any>(null);
  const timeElapsedRef = useRef(0);
  const isPausedRef = useRef(false);

  // Animação de posição vertical e opacidade
  // Não usa translateX porque o card é fixo horizontalmente — apenas swipe up para dispensar
  const translateY = useRef(new Animated.Value(-160)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const isEmergencia =
    notification?.prioridade === 'urgente' ||
    notification?.tipo === 'emergencia' ||
    notification?.categoria === 'seguranca_conta';

  const accentColor = isEmergencia ? '#DC2626' : '#2E5A36';
  const hasAction = Boolean(notification?.acao_url);
  const autoDismissDuration = hasAction ? 7000 : 5000;

  // Atualiza tempo relativo ("agora" -> "1 min" -> "2 min")
  useEffect(() => {
    if (!notification) return;
    setTempoRelativo('agora');
    timeElapsedRef.current = 0;
    const interval = setInterval(() => {
      timeElapsedRef.current += 30;
      if (timeElapsedRef.current < 60) {
        setTempoRelativo('agora');
      } else {
        const mins = Math.floor(timeElapsedRef.current / 60);
        setTempoRelativo(`${mins} min`);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [notification]);

  // Função para dispensar com animação fluida para cima
  const animateDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -170,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
      translateY.setValue(-160);
      opacity.setValue(0);
    });
  }, [onDismiss, translateY, opacity]);

  // Inicia o timer de auto-dismiss (pausável durante toque/arrasto)
  const startTimer = useCallback((remainingMs: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!isPausedRef.current) {
        animateDismiss();
      }
    }, remainingMs);
  }, [animateDismiss]);

  // Animação de entrada e feedback tátil ao receber nova notificação
  useEffect(() => {
    if (notification) {
      timeElapsedRef.current = 0;
      isPausedRef.current = false;

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          isEmergencia
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }

      // Efeito mola suave de entrada descendo do topo
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      startTimer(autoDismissDuration);
    } else {
      translateY.setValue(-160);
      opacity.setValue(0);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification, isEmergencia, translateY, opacity, autoDismissDuration, startTimer]);

  // PanResponder exclusivo de eixo vertical:
  // - Fixo horizontalmente (sem arrasto pros lados)
  // - Swipe up fluido com resposta imediata
  // - Toque simples abre a notificação
  // - Puxar para baixo tem resistência com mola de retorno
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
        onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 2,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: () => {
          isPausedRef.current = true;
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        },

        onPanResponderMove: (_, gesture) => {
          if (gesture.dy <= 0) {
            // Arrastando diretamente para cima — acompanha o dedo sem lag
            translateY.setValue(gesture.dy);
          } else {
            // Resistência elástica amortecida para baixo (não deixa descer na tela)
            translateY.setValue(gesture.dy * 0.18);
          }
        },

        onPanResponderRelease: (_, gesture) => {
          isPausedRef.current = false;

          // 1. Jogar para cima: se arrastou para cima > 16px ou deu flick para cima
          if (gesture.dy < -16 || gesture.vy < -0.22) {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            animateDismiss();
            return;
          }

          // 2. Toque simples sem arrasto: abre a notificação diretamente
          if (Math.abs(gesture.dy) < 5 && Math.abs(gesture.dx) < 5 && notification) {
            if (Platform.OS !== 'web') {
              Haptics.selectionAsync().catch(() => {});
            }
            animateDismiss();
            onPress(notification);
            return;
          }

          // 3. Caso contrário, retorna suavemente para a posição inicial (spring)
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 75,
            useNativeDriver: true,
          }).start();

          // Retoma o timer de fechamento
          startTimer(3500);
        },
      }),
    [animateDismiss, notification, onPress, startTimer, translateY]
  );

  if (!notification) {
    return null;
  }

  const topPosition = Math.max(insets.top, Platform.OS === 'android' ? 24 : 12) + 6;

  // Rótulo da ação rápida baseado na categoria
  const labelAcao =
    notification.tipo === 'chat'
      ? 'Responder'
      : notification.categoria === 'pedidos_orcamentos'
      ? 'Ver Cotação'
      : notification.categoria === 'visitas_execucao'
      ? 'Ver Visita'
      : 'Visualizar';

  const categoriaTag =
    notification.categoria === 'pedidos_orcamentos'
      ? 'COTAÇÃO'
      : notification.categoria === 'visitas_execucao'
      ? 'VISITA TÉCNICA'
      : notification.categoria === 'seguranca_conta'
      ? 'SEGURANÇA'
      : 'SOLFY CONDO';

  return (
    <View
      style={[styles.portalOverlay, { top: topPosition }]}
      pointerEvents="box-none"
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.container,
          {
            width: BANNER_WIDTH,
            borderLeftColor: accentColor,
            transform: [{ translateY }],
            opacity,
          },
        ]}
        accessibilityRole="alert"
        aria-live="assertive"
      >
        {/* Linha Superior: Nome/Categoria + Fila de espera + Tempo relativo (Sem Logo e Sem Botão X) */}
        <View style={styles.headerRow}>
          <View style={styles.leftMeta}>
            <View style={[styles.dotIndicator, { backgroundColor: accentColor }]} />
            <Text style={styles.categoriaTxt}>{categoriaTag}</Text>
            {countInQueue > 1 && (
              <View style={styles.badgeFila}>
                <Text style={styles.badgeFilaTxt}>+{countInQueue - 1}</Text>
              </View>
            )}
          </View>
          <View style={styles.rightMeta}>
            <Text style={styles.timeTxt}>{tempoRelativo}</Text>
          </View>
        </View>

        {/* Conteúdo: Título e Corpo (Sem TouchableOpacity interno para garantir drag 100% fluido) */}
        <View style={styles.contentArea}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {notification.titulo}
          </Text>
          <Text style={styles.body} numberOfLines={2} ellipsizeMode="tail">
            {notification.corpo}
          </Text>
        </View>

        {/* Ação rápida contextual / indicador de toque */}
        {hasAction ? (
          <View style={styles.actionRow}>
            <Text style={[styles.actionTxt, { color: accentColor }]}>{labelAcao}</Text>
            <ChevronRight size={13} color={accentColor} />
          </View>
        ) : (
          /* Pílula sutil de affordance indicando gesto de jogar para cima */
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  portalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999999,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    // Sombra suave estilo Apple Notification Card / Heads-Up
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
      default: {
        shadowColor: '#092215',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 10,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  leftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoriaTxt: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badgeFila: {
    backgroundColor: '#E2EFE4',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  badgeFilaTxt: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1E3E25',
  },
  rightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeTxt: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  contentArea: {
    paddingVertical: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 3,
  },
  actionTxt: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  handleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingTop: 2,
  },
  handleBar: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
});

export default HeadsUpNotification;
