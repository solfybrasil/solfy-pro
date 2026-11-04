import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

type IllustrationType = 'empty-orders' | 'offline' | 'empty-services' | 'empty-notifications';

interface EmptyStateIllustrationProps {
  type: IllustrationType;
  title: string;
  description?: string;
  style?: any;
}

// Mapa das ilustrações reais do pacote Manchester
const ILLUSTRATIONS: Record<IllustrationType, any> = {
  'offline':               require('../assets/illustrations/no-connection.svg'),
  'empty-orders':          require('../assets/illustrations/working-together.svg'),
  'empty-services':        require('../assets/illustrations/soon-clock.svg'),
  'empty-notifications':   require('../assets/illustrations/no-messages.svg'),
};

// Cores de destaque por tipo
const ACCENTS: Record<IllustrationType, string> = {
  'offline':             '#FFB949',
  'empty-orders':        '#FF7449',
  'empty-services':      '#FF7449',
  'empty-notifications': '#FFB949',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function EmptyStateIllustration({
  type,
  title,
  description,
  style,
}: EmptyStateIllustrationProps) {
  const { C } = useTheme();

  // Reanimated values matching the Web Admin styles
  const floatY = useSharedValue(0);
  const floatRotate = useSharedValue(0);
  
  const pulseScale  = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  // Orbit angle (linear loop)
  const orbitAngle = useSharedValue(0);

  // Corner sparkles (diamonds scale & rotate)
  const sparkle1 = useSharedValue(0);
  const sparkle2 = useSharedValue(0);
  const sparkle3 = useSharedValue(0);

  // Offline shake
  const shake  = useSharedValue(0);

  useEffect(() => {
    // 1. Float Animation: translateY and small rotate (3.5s cycle)
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    floatRotate.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1150, easing: Easing.inOut(Easing.ease) }),
        withTiming(-0.5, { duration: 1150, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // 2. Pulse backdrop (2.5s cycle)
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(0.94, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // 3. Orbit Rotation (8s cycle)
    orbitAngle.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );

    // 4. Sparkles delay matching the CSS animation-delay
    sparkle1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    const t2 = setTimeout(() => {
      sparkle2.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, 700);

    const t3 = setTimeout(() => {
      sparkle3.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, 1400);

    // 5. Offline shake if no connection
    if (type === 'offline') {
      shake.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 80 }),
          withTiming(5,  { duration: 80 }),
          withTiming(-3, { duration: 70 }),
          withTiming(3,  { duration: 70 }),
          withTiming(0,  { duration: 80 }),
        ),
        -1,
        false
      );
    } else {
      shake.value = withTiming(0, { duration: 100 });
    }

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [type]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotate: `${floatRotate.value}deg` }
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value * 0.15,
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  // Orbit styles: Orbit 1 (radius 68px, clockwise)
  const orbitStyle1 = useAnimatedStyle(() => {
    const radius = 68;
    const tx = radius * Math.cos(orbitAngle.value);
    const ty = radius * Math.sin(orbitAngle.value);
    return {
      transform: [{ translateX: tx }, { translateY: ty }],
    };
  });

  // Orbit styles: Orbit 2 (radius 48px, counterclockwise)
  const orbitStyle2 = useAnimatedStyle(() => {
    const radius = 48;
    const tx = radius * Math.cos(-orbitAngle.value - Math.PI);
    const ty = radius * Math.sin(-orbitAngle.value - Math.PI);
    return {
      transform: [{ translateX: tx }, { translateY: ty }],
    };
  });

  // Sparkle styles: scale and rotate
  const sparkleStyle1 = useAnimatedStyle(() => ({
    transform: [
      { scale: sparkle1.value },
      { rotate: `${sparkle1.value * 180 + 45}deg` }
    ],
    opacity: sparkle1.value * 0.7,
  }));

  const sparkleStyle2 = useAnimatedStyle(() => ({
    transform: [
      { scale: sparkle2.value },
      { rotate: `${sparkle2.value * 180 + 45}deg` }
    ],
    opacity: sparkle2.value * 0.5,
  }));

  const sparkleStyle3 = useAnimatedStyle(() => ({
    transform: [
      { scale: sparkle3.value },
      { rotate: `${sparkle3.value * 180 + 45}deg` }
    ],
    opacity: sparkle3.value * 0.6,
  }));

  const accent = ACCENTS[type];

  return (
    <View style={[styles.container, style]}>
      {/* Wrapper externo — shake para offline, estático para outros */}
      <Animated.View style={[styles.frame, type === 'offline' ? shakeStyle : undefined]}>

        {/* Glow backdrop animado */}
        <Animated.View
          style={[
            styles.glow,
            pulseStyle,
            { backgroundColor: accent },
          ]}
        />

        {/* Ilustração flutuante */}
        <Animated.View style={[styles.illus, floatStyle]}>
          <Image
            source={ILLUSTRATIONS[type]}
            style={styles.illustrationImage}
            contentFit="contain"
            transition={300}
          />
        </Animated.View>

        {/* Pontinhos orbitais decorativos (Orbiting sparkle dots) */}
        <View style={styles.orbitContainer}>
          <Animated.View
            style={[
              styles.orbitDot,
              { backgroundColor: accent },
              orbitStyle1,
            ]}
          />
          <Animated.View
            style={[
              styles.orbitDotSm,
              { backgroundColor: accent },
              orbitStyle2,
            ]}
          />
        </View>

        {/* Sparkles de canto estilo diamante do Site ADM */}
        <Animated.View style={[styles.diamondSparkle, sparkleStyle1, { top: 12, right: 28, backgroundColor: accent }]} />
        <Animated.View style={[styles.diamondSparkleSm, sparkleStyle2, { bottom: 20, left: 24, backgroundColor: accent }]} />
        <Animated.View style={[styles.diamondSparkleXs, sparkleStyle3, { top: 36, left: 16, backgroundColor: accent }]} />
      </Animated.View>

      <Text style={[styles.title, { color: C.textPrimary }]}>{title}</Text>
      {description && (
        <Text style={[styles.desc, { color: C.textSecondary }]}>{description}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  frame: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  illus: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  illustrationImage: {
    width: 180,
    height: 180,
  },
  orbitContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  orbitDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  orbitDotSm: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  diamondSparkle: {
    position: 'absolute',
    width: 10,
    height: 10,
  },
  diamondSparkleSm: {
    position: 'absolute',
    width: 8,
    height: 8,
  },
  diamondSparkleXs: {
    position: 'absolute',
    width: 6,
    height: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
});
