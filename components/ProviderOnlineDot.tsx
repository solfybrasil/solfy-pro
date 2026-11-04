/**
 * ProviderOnlineDot.tsx
 * Bolinha flutuante verde no canto inferior direito.
 * Pulsa suavemente quando o prestador está online.
 * Visível apenas dentro do app quando online = true.
 */

import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Platform, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wifi } from 'lucide-react-native';

interface ProviderOnlineDotProps {
  online: boolean;
  onPress?: () => void;
  /** Altura da TabBar para não sobrepor (padrão 60) */
  tabBarHeight?: number;
}

export default function ProviderOnlineDot({
  online,
  onPress,
  tabBarHeight = 60,
}: ProviderOnlineDotProps) {
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Entrada suave
  useEffect(() => {
    if (online) {
      opacity.value = withTiming(1, { duration: 400 });
      // Pulso principal — escala leve
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      // Anel 1 — expand e desvanece
      ring1.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      // Anel 2 — expand e desvanece com delay
      setTimeout(() => {
        ring2.value = withRepeat(
          withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }),
          -1,
          false
        );
      }, 600);
    } else {
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [online]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [1, 1.08]) },
    ],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.3, 1], [0.7, 0.5, 0]),
    transform: [{ scale: interpolate(ring1.value, [0, 1], [1, 2.4]) }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.3, 1], [0.7, 0.5, 0]),
    transform: [{ scale: interpolate(ring2.value, [0, 1], [1, 2.4]) }],
  }));

  // Posição: 20px da borda direita, acima da TabBar + inset de segurança
  const bottomOffset = tabBarHeight + insets.bottom + 16;

  if (!online && opacity.value === 0) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: bottomOffset, pointerEvents: 'box-none' },
        dotStyle,
      ]}
    >
      {/* Anéis de pulso */}
      <Animated.View style={[styles.ring, ring1Style]} />
      <Animated.View style={[styles.ring, ring2Style]} />

      {/* Botão principal */}
      <TouchableOpacity
        onPress={onPress}
        style={styles.dot}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Wifi size={18} color="#FFF" strokeWidth={2.5} />
        <View style={styles.activeDot} />
      </TouchableOpacity>

      {/* Label */}
      <View style={styles.labelBubble}>
        <Text style={styles.labelText}>Online</Text>
      </View>
    </Animated.View>
  );
}

const DOT_SIZE = 52;
const RING_SIZE = DOT_SIZE;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 18,
    zIndex: 8000,
    alignItems: 'center',
    justifyContent: 'center',
    width: DOT_SIZE,
    // inclui o label abaixo
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: '#22C55E',
    opacity: 0,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra
    ...Platform.select({
      ios: {
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  activeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#86EFAC',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  labelBubble: {
    marginTop: 6,
    backgroundColor: 'rgba(22,163,74,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  labelText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
