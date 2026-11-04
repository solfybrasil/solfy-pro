import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface ShimmerTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  color?: string;
}

export function ShimmerText({ text, style, color = '#F59E0B' }: ShimmerTextProps) {
  return (
    <Text style={[{ color, fontWeight: '800', letterSpacing: 0.2 }, style]}>
      {text}
    </Text>
  );
}
