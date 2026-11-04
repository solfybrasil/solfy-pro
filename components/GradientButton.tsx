import React, { memo, useCallback } from 'react';
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Platform,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Paleta Oficial Solfy Condo — Verde Militar
export const SOLFY_GRADIENT_PRIMARY = ['#132817', '#1E3E25', '#2E5A36'] as const;
export const SOLFY_GRADIENT_SECONDARY = ['#EDF4EE', '#E2ECE4'] as const;
export const SOLFY_GRADIENT_ACCENT = ['#1E3E25', '#3A7045'] as const;
export const SOLFY_GRADIENT_TRANSPARENT = ['transparent', 'transparent'] as const;

export interface GradientButtonProps {
  onPress?: () => void;
  title?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'circular' | 'outline' | 'pill' | 'icon' | 'ghost';
  colors?: readonly [string, string, ...string[]];
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'sm' | 'md' | 'lg';
  accessibilityLabel?: string;
  testID?: string;
  hitSlop?: any;
}

const SPRING_CONFIG_HOVER = { damping: 16, stiffness: 240, mass: 0.8 };
const SPRING_CONFIG_PRESS = { damping: 22, stiffness: 360, mass: 0.6 };
const SPRING_CONFIG_RELEASE = { damping: 18, stiffness: 260, mass: 0.8 };

export const GradientButton = memo(function GradientButton({
  onPress,
  title,
  children,
  icon,
  rightIcon,
  variant = 'primary',
  colors,
  disabled = false,
  loading = false,
  loadingText,
  style,
  contentStyle,
  textStyle,
  size = 'md',
  accessibilityLabel,
  testID,
  hitSlop,
}: GradientButtonProps) {
  const isHovered = useSharedValue(0);
  const isPressed = useSharedValue(0);

  const isCircular = variant === 'circular';
  const isIcon = variant === 'icon';
  const isGhost = variant === 'ghost';
  const isSecondary = variant === 'secondary' || variant === 'outline';
  const isPill = variant === 'pill';

  const defaultColors =
    colors ||
    (isGhost
      ? SOLFY_GRADIENT_TRANSPARENT
      : isSecondary || isIcon
      ? SOLFY_GRADIENT_SECONDARY
      : SOLFY_GRADIENT_PRIMARY);

  const handleHoverIn = useCallback(() => {
    if (disabled || loading) return;
    isHovered.value = withSpring(1, SPRING_CONFIG_HOVER);
  }, [disabled, loading]);

  const handleHoverOut = useCallback(() => {
    isHovered.value = withSpring(0, SPRING_CONFIG_RELEASE);
  }, []);

  const handlePressIn = useCallback(() => {
    if (disabled || loading) return;
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    isPressed.value = withSpring(1, SPRING_CONFIG_PRESS);
  }, [disabled, loading]);

  const handlePressOut = useCallback(() => {
    isPressed.value = withSpring(0, SPRING_CONFIG_RELEASE);
  }, []);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    // Remove o foco do botão na Web para evitar o warning "Blocked aria-hidden on an element because its descendant retained focus"
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        (document.activeElement as HTMLElement)?.blur?.();
      } catch {}
    }
    onPress?.();
  }, [disabled, loading, onPress]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    // Escala dinâmica: hover expande suavemente, click contrai com física mecânica
    const hoverScale = isCircular ? 1.05 : isIcon ? 1.06 : 1.025;
    const pressScale = isCircular ? 0.93 : isIcon ? 0.92 : 0.96;

    const scaleFromHover = interpolate(isHovered.value, [0, 1], [1, hoverScale]);
    const scaleFromPress = interpolate(isPressed.value, [0, 1], [1, pressScale]);
    const combinedScale = scaleFromHover * scaleFromPress;

    if (Platform.OS === 'web') {
      const isH = isHovered.value > 0.5;
      const isP = isPressed.value > 0.5;
      const blur = isCircular ? (isH ? 14 : 8) : isIcon ? (isH ? 8 : 4) : isH ? 18 : 10;
      const op = isSecondary || isIcon ? (isH ? 0.22 : 0.1) : isH ? 0.44 : 0.28;
      const y = isP ? 2 : isH ? 6 : 4;
      return {
        transform: [{ scale: combinedScale }],
        boxShadow: `0px ${y}px ${blur}px rgba(19, 40, 23, ${op})`,
      } as any;
    }

    const shadowRadius = interpolate(
      isHovered.value,
      [0, 1],
      [isCircular ? 8 : isIcon ? 4 : 10, isCircular ? 14 : isIcon ? 8 : 18]
    );
    const shadowOpacity = interpolate(
      isHovered.value,
      [0, 1],
      [isSecondary || isIcon ? 0.1 : 0.28, isSecondary || isIcon ? 0.22 : 0.44]
    );

    return {
      transform: [{ scale: combinedScale }],
      shadowRadius,
      shadowOpacity,
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(isHovered.value, [0, 1], [0, isSecondary || isIcon ? 0.15 : 0.32]),
    };
  });

  // Tamanhos e alturas padronizadas
  const containerSizeStyle = isCircular
    ? styles.circularSize
    : isIcon
    ? styles.iconSize
    : isPill
    ? styles.pillSize
    : isGhost
    ? styles.ghostSize
    : size === 'sm'
    ? styles.sizeSm
    : size === 'lg'
    ? styles.sizeLg
    : styles.sizeMd;

  return (
    <Pressable
      onPress={disabled || loading ? undefined : handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      disabled={disabled || loading}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      testID={testID}
      style={[
        styles.pressableReset,
        disabled && styles.disabledPressable,
        Platform.OS === 'web' && ({ cursor: disabled || loading ? 'not-allowed' : 'pointer' } as any),
      ]}
    >
      <Animated.View
        style={[
          styles.baseContainer,
          containerSizeStyle,
          (isSecondary || isIcon) && styles.secondaryBorder,
          (isCircular || isIcon) && styles.circularContainer,
          isGhost && styles.ghostContainer,
          animatedContainerStyle,
          disabled && styles.disabledContainer,
          style,
        ]}
      >
        <LinearGradient
          colors={defaultColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.85 }}
          style={[styles.gradientFill, (isCircular || isIcon) && styles.circularGradient]}
        >
          {/* Brilho de Topo / Reflexo Esculpido (exceto no ghost) */}
          {!isGhost && (
            <View
              style={[
                styles.topHighlight,
                (isSecondary || isIcon) && styles.topHighlightSecondary,
                (isCircular || isIcon) && styles.circularHighlight,
              ]}
            />
          )}

          {/* Halo Glow animado que acende suavemente no hover (pointerEvents via style para compatibilidade web) */}
          {!isGhost && (
            <Animated.View
              style={[
                styles.hoverGlowOverlay,
                (isSecondary || isIcon) && styles.hoverGlowOverlaySecondary,
                (isCircular || isIcon) && styles.circularGlowOverlay,
                animatedGlowStyle,
              ]}
            />
          )}

          {/* Conteúdo do Botão */}
          <View
            style={[
              styles.contentRow,
              (isCircular || isIcon) && styles.circularContent,
              contentStyle,
            ]}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator
                  size="small"
                  color={isSecondary || isIcon ? '#1E3E25' : '#FFFFFF'}
                />
                {loadingText ? (
                  <Text
                    style={[
                      styles.defaultText,
                      (isSecondary || isIcon) && styles.secondaryText,
                      textStyle,
                    ]}
                  >
                    {loadingText}
                  </Text>
                ) : null}
              </View>
            ) : children ? (
              children
            ) : (
              <>
                {icon ? <View style={!title && !rightIcon ? undefined : styles.iconLeft}>{icon}</View> : null}
                {title ? (
                  <Text
                    style={[
                      styles.defaultText,
                      (isSecondary || isIcon) && styles.secondaryText,
                      textStyle,
                    ]}
                  >
                    {title}
                  </Text>
                ) : null}
                {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
              </>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressableReset: {
    outlineWidth: 0,
    userSelect: 'none',
  } as any,
  baseContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 4px 10px rgba(19, 40, 23, 0.28)' } as any)
      : {
          shadowColor: '#132817',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 10,
          elevation: 4,
        }),
  },
  sizeSm: {
    height: 42,
  },
  sizeMd: {
    height: 52,
  },
  sizeLg: {
    height: 56,
  },
  pillSize: {
    height: 34,
    borderRadius: 17,
  },
  circularSize: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  iconSize: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  ghostSize: {
    height: 'auto',
  },
  ghostContainer: {
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'none' } as any)
      : {
          shadowOpacity: 0,
          elevation: 0,
        }),
    borderRadius: 8,
  },
  circularContainer: {
    borderRadius: 30,
  },
  secondaryBorder: {
    borderWidth: 1.5,
    borderColor: '#C3D8C8',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 2px 6px rgba(30, 62, 37, 0.1)' } as any)
      : {
          shadowColor: '#1E3E25',
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  gradientFill: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circularGradient: {
    borderRadius: 30,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  topHighlightSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  circularHighlight: {
    borderRadius: 30,
  },
  hoverGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3A7045',
    pointerEvents: 'none' as any,
  },
  hoverGlowOverlaySecondary: {
    backgroundColor: '#D0E5D5',
  },
  circularGlowOverlay: {
    borderRadius: 30,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    width: '100%',
    height: '100%',
  },
  circularContent: {
    paddingHorizontal: 0,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  defaultText: {
    fontFamily: 'Arial Rounded MT Bold',
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  secondaryText: {
    fontFamily: 'Arial Rounded MT Bold',
    color: '#132817',
    fontWeight: '800',
  },
  disabledPressable: {
    opacity: 0.6,
  },
  disabledContainer: {
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'none' } as any)
      : {
          shadowOpacity: 0.05,
          elevation: 0,
        }),
  },
});

export default GradientButton;
