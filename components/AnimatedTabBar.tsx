import React, { useEffect, useState, useMemo, useRef, memo, useCallback } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

export const TAB_BAR_HEIGHT = 64;
const PILL_HEIGHT = 48;
/** Quanto a aba selecionada é mais larga que as outras (2.6 = 2,6x). Maior = empurra mais. */
const ACTIVE_WEIGHT = 2.6;

// Molas ultrarrápidas e firmes para resposta instantânea (< 220ms de assentamento)
const SPRING = { damping: 22, stiffness: 420, mass: 0.6 };
const LEAD = { damping: 24, stiffness: 520, mass: 0.6 };
const TRAIL = { damping: 24, stiffness: 340, mass: 0.6 };
const PILL_INSET = 2;

const ICON_SIZE = 20;
const GAP = 6;
const SIDE_PADDING = 10;

// Paleta Oficial Solfy — Verde Musgo
const GRADIENT_COLORS = ['#132817', '#2E5A36'] as const;
const GLOW_COLOR = '#2E5A36';

// Whitelist ESTRITA das 5 abas oficiais — NUNCA acrescenta nenhuma outra
const TAB_KEYS_OFICIAIS = ['demandas/index', 'agenda/index', 'index', 'chat/index', 'perfil/index'] as const;

/** Espaço que as telas precisam deixar embaixo por causa da barra flutuante. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 20;
}

// ─── Componente Isolado de Badge (Evita re-render de toda a tab bar ao receber notificação) ───
const TabBadgeDot = memo(function TabBadgeDot({
  routeName,
  badge,
}: {
  routeName: string;
  badge?: number | string;
}) {
  const { naoLidasTotal } = useNotifications();
  const count = badge ?? (routeName === 'index' && naoLidasTotal > 0 ? naoLidasTotal : undefined);
  if (count == null || count === '' || count === 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText} numberOfLines={1}>
        {typeof count === 'number' && count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
});

// ─── Individual Tab Item ──────────────────────────────────────────────────────
interface TabItemProps {
  route: any;
  focused: boolean;
  label: string;
  badge?: number | string;
  renderIcon: (color: string) => React.ReactNode;
  inactiveWidth: number;
  activeWidth: number;
  inactiveColor: string;
  onPress: () => void;
  onPressIn: () => void;
  onLongPress: () => void;
  testID?: string;
  reduceMotion: boolean;
}

const TabItem = memo(function TabItem({
  route,
  focused,
  label,
  badge,
  renderIcon,
  inactiveWidth,
  activeWidth,
  inactiveColor,
  onPress,
  onPressIn,
  onLongPress,
  testID,
  reduceMotion,
}: TabItemProps) {
  const progress = useSharedValue(focused ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    progress.value = reduceMotion
      ? withTiming(focused ? 1 : 0, { duration: 0 })
      : withSpring(focused ? 1 : 0, SPRING);
  }, [focused, reduceMotion]);

  const maxLabel = Math.max(activeWidth - ICON_SIZE - GAP - SIDE_PADDING * 2, 0);

  // A aba cresce e as outras encolhem na UI thread via transform / width
  const itemStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [inactiveWidth, activeWidth]),
  }));

  // Animação de press: leve compressão imediata no ícone
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.90]) }],
  }));

  // O nome entra deslizando ao lado do ícone com fade in rápido
  const labelStyle = useAnimatedStyle(() => ({
    maxWidth: interpolate(progress.value, [0, 1], [0, maxLabel], Extrapolation.CLAMP),
    marginLeft: interpolate(progress.value, [0, 1], [0, GAP], Extrapolation.CLAMP),
    opacity: interpolate(progress.value, [0.35, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-8, 0], Extrapolation.CLAMP) }],
  }));

  // Transição de opacidade da cor do ícone sincronizada na GPU
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.25, 0.75], [0, 1], Extrapolation.CLAMP),
  }));

  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.25, 0.75], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.itemWrap, itemStyle]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          pressed.value = withTiming(1, { duration: 60 });
          onPressIn();
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, SPRING);
        }}
        style={styles.pressable}
        hitSlop={4}
      >
        <View style={styles.content}>
          <Animated.View style={iconStyle}>
            <View style={styles.iconContainer}>
              <Animated.View style={[styles.iconLayer, inactiveIconStyle]}>
                {renderIcon(inactiveColor)}
              </Animated.View>
              <Animated.View style={[styles.iconLayer, activeIconStyle]}>
                {renderIcon('#FFFFFF')}
              </Animated.View>
            </View>
            <TabBadgeDot routeName={route.name} badge={badge} />
          </Animated.View>
          <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
            {label}
          </Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

// ─── AnimatedTabBar Main Dock ────────────────────────────────────────────────
function AnimatedTabBarComponent({ state, descriptors, navigation }: BottomTabBarProps) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();

  const currentRoute = state.routes[state.index];
  const currentRouteName = currentRoute?.name;
  const currentOptions = currentRoute ? descriptors[currentRoute.key]?.options : undefined;

  const visibleRoutes = useMemo(
    () =>
      TAB_KEYS_OFICIAIS
        .map(name => state.routes.find(r => r.name === name || r.name === name.replace('/index', '')))
        .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    [state.routes],
  );

  const activeIndex = useMemo(() => {
    let target = currentRouteName;
    if (
      target === 'demandas' ||
      target === 'demandas/index' ||
      target === 'demandas/[id]' ||
      target === 'demandas/nova' ||
      target === 'demanda/[id]' ||
      target === 'cotacao/[id]' ||
      target === 'nova-demanda' ||
      target?.startsWith('demandas')
    ) {
      target = 'demandas/index';
    } else if (target === 'agenda' || target === 'agenda/index' || target === 'agenda/[id]' || target?.startsWith('agenda')) {
      target = 'agenda/index';
    } else if (target === 'chat' || target === 'chat/index' || target === 'chat/[id]' || target?.startsWith('chat')) {
      target = 'chat/index';
    } else if (target === 'perfil' || target === 'perfil/index' || target === 'perfil/[secao]' || target?.startsWith('perfil')) {
      target = 'perfil/index';
    } else if (target === 'index') {
      target = 'index';
    }
    const idx = visibleRoutes.findIndex(r => r.name === target || r.name === target?.replace('/index', ''));
    return idx !== -1 ? idx : 2;
  }, [visibleRoutes, currentRouteName]);

  // Índice otimista imediato no toque (resposta no mesmo frame)
  const [optimisticIndex, setOptimisticIndex] = useState(activeIndex);

  useEffect(() => {
    setOptimisticIndex(activeIndex);
  }, [activeIndex]);

  const dockWidth = Math.min(windowWidth - 28, 440);
  const initialRowWidth = dockWidth - 12; // paddingHorizontal: 6 * 2
  const [rowWidth, setRowWidth] = useState(initialRowWidth);

  // Larguras: uma "unidade" para cada aba normal e ACTIVE_WEIGHT unidades para a selecionada.
  const unit = visibleRoutes.length ? rowWidth / (visibleRoutes.length - 1 + ACTIVE_WEIGHT) : 0;
  const inactiveWidth = unit;
  const activeWidth = unit * ACTIVE_WEIGHT;

  // ---- Pílula que DESLIZA de uma aba para a outra (Efeito Gota Líquida Reanimated) ----
  const leftEdge = useSharedValue(activeIndex * inactiveWidth + PILL_INSET);
  const rightEdge = useSharedValue(activeIndex * inactiveWidth + activeWidth - PILL_INSET);
  const prevIndex = useRef<number>(activeIndex);

  // Função para disparar a animação da pílula imediatamente no toque
  const moverPilula = useCallback((targetIndex: number) => {
    if (!unit) return;
    const targetLeft = targetIndex * inactiveWidth + PILL_INSET;
    const targetRight = targetIndex * inactiveWidth + activeWidth - PILL_INSET;
    const prev = prevIndex.current;
    prevIndex.current = targetIndex;

    if (reduceMotion) {
      leftEdge.value = targetLeft;
      rightEdge.value = targetRight;
      return;
    }

    const goingRight = targetIndex > prev;
    leftEdge.value = withSpring(targetLeft, goingRight ? TRAIL : LEAD);
    rightEdge.value = withSpring(targetRight, goingRight ? LEAD : TRAIL);
  }, [unit, inactiveWidth, activeWidth, reduceMotion]);

  // Sincroniza com o navigator caso ocorra navegação externa ou cancelamento
  useEffect(() => {
    moverPilula(activeIndex);
  }, [activeIndex, moverPilula]);

  const slidingPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftEdge.value }],
    width: Math.max(rightEdge.value - leftEdge.value, 0),
  }));

  const handlers = useMemo(
    () =>
      visibleRoutes.map((route, index) => ({
        onPressIn: () => {
          if (optimisticIndex !== index) {
            setOptimisticIndex(index);
            moverPilula(index);
            if (Platform.OS !== 'web') {
              Haptics.selectionAsync().catch(() => {});
            }
          }
        },
        onPress: () => {
          const isCurrent = activeIndex === index;
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isCurrent && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, merge: true } as any);
          }
        },
        onLongPress: () => navigation.emit({ type: 'tabLongPress', target: route.key }),
      })),
    [visibleRoutes, activeIndex, optimisticIndex, moverPilula, navigation],
  );

  if (!session) {
    return null;
  }

  // O dock se oculta APENAS em telas de detalhes e fluxos aninhados, NUNCA nas 5 abas principais
  const isHidden =
    !currentRouteName ||
    currentRouteName === 'demanda/[id]' ||
    currentRouteName === 'cotacao/[id]' ||
    currentRouteName === 'demandas/[id]' ||
    currentRouteName === 'demandas/nova' ||
    currentRouteName === 'demandas/[id]/cotacao/[cotacaoId]' ||
    currentRouteName === 'nova-demanda' ||
    currentRouteName === 'agenda/[id]' ||
    currentRouteName === 'chat/[id]' ||
    currentRouteName === 'perfil/[secao]' ||
    currentRouteName === 'notificacoes' ||
    currentRouteName === 'notificacoes/index' ||
    currentRouteName.startsWith('notificacoes') ||
    (currentRouteName.startsWith('demandas/') && currentRouteName !== 'demandas/index') ||
    (currentRouteName.startsWith('agenda/') && currentRouteName !== 'agenda/index') ||
    (currentRouteName.startsWith('chat/') && currentRouteName !== 'chat/index') ||
    (currentRouteName.startsWith('perfil/') && currentRouteName !== 'perfil/index') ||
    (currentOptions?.tabBarStyle as any)?.display === 'none';

  if (isHidden) {
    return null;
  }

  const bottomMargin = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 10) + (Platform.OS === 'android' ? 6 : 4);

  return (
    <View
      style={[
        styles.dockContainer,
        {
          bottom: bottomMargin,
          ...(Platform.OS === 'web' ? { pointerEvents: 'box-none' as any } : {}),
        },
      ]}
      pointerEvents={Platform.OS !== 'web' ? 'box-none' : undefined}
    >
      <View style={[styles.dockBar, { width: dockWidth }]}>
        <View
          style={styles.row}
          onLayout={(e: LayoutChangeEvent) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - rowWidth) > 1) {
              setRowWidth(w);
            }
          }}
        >
          {/* Pílula Deslizante com Gradiente Verde Musgo Solfy */}
          {unit > 0 && (
            <Animated.View pointerEvents="none" style={[styles.slidingPill, slidingPillStyle]}>
              {Platform.OS !== 'android' && <View style={styles.glowUnderlay} />}
              <LinearGradient
                colors={GRADIENT_COLORS}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}

          {/* Abas com Acordeão e Empurrão Suave */}
          {unit > 0 &&
            visibleRoutes.map((route, index) => {
              const { options } = descriptors[route.key];
              const rawLabel =
                options.tabBarLabel !== undefined
                  ? options.tabBarLabel
                  : options.title !== undefined
                  ? options.title
                  : route.name.replace('/index', '');
              const isFocused = optimisticIndex === index;

              return (
                <TabItem
                  key={route.key}
                  route={route}
                  focused={isFocused}
                  label={String(rawLabel)}
                  badge={options.tabBarBadge}
                  renderIcon={(color) => options.tabBarIcon?.({ focused: isFocused, color, size: ICON_SIZE }) ?? null}
                  inactiveWidth={inactiveWidth}
                  activeWidth={activeWidth}
                  inactiveColor="#64748B"
                  onPressIn={handlers[index]?.onPressIn ?? (() => {})}
                  onPress={handlers[index]?.onPress ?? (() => {})}
                  onLongPress={handlers[index]?.onLongPress ?? (() => {})}
                  testID={options.tabBarButtonTestID || (options as any).tabBarTestID}
                  reduceMotion={Boolean(reduceMotion)}
                />
              );
            })}
        </View>
      </View>
    </View>
  );
}

export default memo(AnimatedTabBarComponent);

const styles = StyleSheet.create({
  dockContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  dockBar: {
    height: TAB_BAR_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderRadius: TAB_BAR_HEIGHT / 2,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...Platform.select({
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 6px 16px rgba(19, 40, 23, 0.08)',
      },
      default: {
        shadowColor: '#132817',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    position: 'relative',
  },
  slidingPill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
  },
  glowUnderlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GLOW_COLOR,
    opacity: 0.15,
  },
  itemWrap: {
    height: PILL_HEIGHT,
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconContainer: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
