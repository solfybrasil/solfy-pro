import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface AuroraBackgroundProps {
  /** Array of hex colors for the background ramp */
  colorStops?: string[];
  /** Wave amplitude (mantido por compatibilidade) */
  amplitude?: number;
  /** Blend strength (mantido por compatibilidade) */
  blend?: number;
  /** Light mode vs Dark mode */
  lightMode?: boolean;
  /** Speed multiplier (mantido por compatibilidade) */
  speed?: number;
  /** Container custom style */
  style?: StyleProp<ViewStyle>;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  colorStops,
  lightMode = true,
  style,
}) => {
  // Gradiente sutil e elegante Verde Musgo / Neutro para o fundo das telas
  const colors: [string, string, ...string[]] = lightMode
    ? (colorStops && colorStops.length >= 2
        ? (colorStops as [string, string, ...string[]])
        : ['#132817', '#2E5A36', '#5C7C63', '#E2EBE4', '#F8FAFC'])
    : ['#0E140A', '#1C2614', '#090E06'];

  const locations: [number, number, ...number[]] | undefined =
    lightMode && (!colorStops || colorStops.length < 2)
      ? [0, 0.22, 0.5, 0.78, 1.0]
      : undefined;

  return (
    <View style={[styles.container, { pointerEvents: 'none' as const }, style]}>
      <LinearGradient
        colors={colors}
        locations={locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});

export default AuroraBackground;
