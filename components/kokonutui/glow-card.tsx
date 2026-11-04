import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

interface GlowCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glowColor?: string;
  intensity?: number;
}

export function GlowCard({
  children,
  style,
  glowColor = '#F59E0B',
  intensity = 0.18,
}: GlowCardProps) {
  const pulse = useSharedValue(0.7);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedGlow = useAnimatedStyle(() => ({
    opacity: pulse.value * intensity,
    transform: [{ scale: 1 + (pulse.value - 0.7) * 0.04 }],
  }));

  return (
    <View style={[styles.wrapper, style]}>
      <Animated.View style={[styles.glowLayer, { backgroundColor: glowColor }, animatedGlow]} />
      <View style={styles.contentCard}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginVertical: 6,
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    filter: 'blur(16px)',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    zIndex: 1,
  },
});
