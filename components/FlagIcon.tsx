import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Path, Circle, Polygon } from 'react-native-svg';

interface FlagIconProps {
  countryCode: string;
  width?: number;
  height?: number;
}

export default function FlagIcon({ countryCode, width = 24, height = 16 }: FlagIconProps) {
  const borderRadius = 3;

  switch (countryCode) {
    case '+55': // Brasil (Proporções e cores oficiais com faixa astronômica correta e estrelas)
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 720 500">
            {/* Campo Verde Bandeira */}
            <Rect width="720" height="500" fill="#009739" />

            {/* Losango Amarelo Canário Oficial */}
            <Polygon points="360,48 672,250 360,452 48,250" fill="#FEDD00" />

            {/* Disco Azul Celeste */}
            <Circle cx="360" cy="250" r="126" fill="#002776" />

            {/* Faixa Branca Astronômica (Curvatura Real Ascendente) */}
            <Path
              d="M 238,266 C 300,222 380,208 482,238 C 380,222 300,238 238,280 Z"
              fill="#FFFFFF"
            />

            {/* Estrela Spica (Acima da faixa à direita) */}
            <Circle cx="380" cy="204" r="4.5" fill="#FFFFFF" />

            {/* Constelação Cruzeiro do Sul & Estrelas Abaixo da Faixa */}
            <Circle cx="360" cy="275" r="4" fill="#FFFFFF" /> {/* Alfa Crucis */}
            <Circle cx="360" cy="310" r="4.5" fill="#FFFFFF" /> {/* Gama Crucis */}
            <Circle cx="338" cy="292" r="4" fill="#FFFFFF" /> {/* Beta Crucis */}
            <Circle cx="382" cy="288" r="4" fill="#FFFFFF" /> {/* Delta Crucis */}
            <Circle cx="368" cy="298" r="2.8" fill="#FFFFFF" /> {/* Épsilon (Intrometida) */}

            {/* Outras estrelas */}
            <Circle cx="315" cy="315" r="3.8" fill="#FFFFFF" /> {/* Canopus */}
            <Circle cx="300" cy="285" r="4" fill="#FFFFFF" /> {/* Sirius */}
            <Circle cx="405" cy="320" r="3.5" fill="#FFFFFF" /> {/* Escorpião */}
            <Circle cx="425" cy="330" r="3" fill="#FFFFFF" />
          </Svg>
        </View>
      );

    case '+351': // Portugal
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 600 400">
            <Rect width="240" height="400" fill="#046A38" />
            <Rect x="240" width="360" height="400" fill="#DA291C" />
            <Circle cx="240" cy="200" r="60" fill="#FFC72C" />
            <Rect x="210" y="170" width="60" height="60" rx="6" fill="#ffffff" />
            <Rect x="220" y="178" width="40" height="44" rx="4" fill="#002B7F" />
          </Svg>
        </View>
      );

    case '+1': // Estados Unidos
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 741 390">
            {/* Listras */}
            <Rect width="741" height="390" fill="#B22234" />
            <Rect y="30" width="741" height="30" fill="#FFFFFF" />
            <Rect y="90" width="741" height="30" fill="#FFFFFF" />
            <Rect y="150" width="741" height="30" fill="#FFFFFF" />
            <Rect y="210" width="741" height="30" fill="#FFFFFF" />
            <Rect y="270" width="741" height="30" fill="#FFFFFF" />
            <Rect y="330" width="741" height="30" fill="#FFFFFF" />
            {/* Cantão azul */}
            <Rect width="296" height="210" fill="#3C3B6E" />
            {/* Estrelas representativas */}
            <Circle cx="60" cy="50" r="10" fill="#FFFFFF" />
            <Circle cx="120" cy="50" r="10" fill="#FFFFFF" />
            <Circle cx="180" cy="50" r="10" fill="#FFFFFF" />
            <Circle cx="240" cy="50" r="10" fill="#FFFFFF" />
            <Circle cx="90" cy="105" r="10" fill="#FFFFFF" />
            <Circle cx="150" cy="105" r="10" fill="#FFFFFF" />
            <Circle cx="210" cy="105" r="10" fill="#FFFFFF" />
            <Circle cx="60" cy="160" r="10" fill="#FFFFFF" />
            <Circle cx="120" cy="160" r="10" fill="#FFFFFF" />
            <Circle cx="180" cy="160" r="10" fill="#FFFFFF" />
            <Circle cx="240" cy="160" r="10" fill="#FFFFFF" />
          </Svg>
        </View>
      );

    case '+54': // Argentina
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 600 375">
            <Rect width="600" height="125" fill="#74ACDF" />
            <Rect y="125" width="600" height="125" fill="#FFFFFF" />
            <Rect y="250" width="600" height="125" fill="#74ACDF" />
            <Circle cx="300" cy="187.5" r="30" fill="#F6B40E" />
            <Circle cx="300" cy="187.5" r="18" fill="#85340A" opacity="0.3" />
          </Svg>
        </View>
      );

    case '+34': // Espanha
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 750 500">
            <Rect width="750" height="125" fill="#AA151B" />
            <Rect y="125" width="750" height="250" fill="#F1BF00" />
            <Rect y="375" width="750" height="125" fill="#AA151B" />
            <Circle cx="220" cy="250" r="45" fill="#AA151B" opacity="0.8" />
          </Svg>
        </View>
      );

    case '+39': // Itália
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 600 400">
            <Rect width="200" height="400" fill="#009246" />
            <Rect x="200" width="200" height="400" fill="#FFFFFF" />
            <Rect x="400" width="200" height="400" fill="#CE2B37" />
          </Svg>
        </View>
      );

    case '+44': // Reino Unido
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 600 300">
            <Rect width="600" height="300" fill="#012169" />
            {/* Diagonais */}
            <Path d="M0,0 L600,300 M600,0 L0,300" stroke="#FFFFFF" strokeWidth="50" />
            <Path d="M0,0 L600,300 M600,0 L0,300" stroke="#C8102E" strokeWidth="26" />
            {/* Cruz central branca */}
            <Rect x="250" y="0" width="100" height="300" fill="#FFFFFF" />
            <Rect x="0" y="100" width="600" height="100" fill="#FFFFFF" />
            {/* Cruz central vermelha */}
            <Rect x="270" y="0" width="60" height="300" fill="#C8102E" />
            <Rect x="0" y="120" width="600" height="60" fill="#C8102E" />
          </Svg>
        </View>
      );

    case '+595': // Paraguai
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 600 330">
            <Rect width="600" height="110" fill="#D52B1E" />
            <Rect y="110" width="600" height="110" fill="#FFFFFF" />
            <Rect y="220" width="600" height="110" fill="#0038A8" />
            <Circle cx="300" cy="165" r="28" fill="#F4B400" />
            <Circle cx="300" cy="165" r="16" fill="#0038A8" />
          </Svg>
        </View>
      );

    case '+598': // Uruguai
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 600 400">
            <Rect width="600" height="400" fill="#FFFFFF" />
            <Rect y="44" width="600" height="44" fill="#0038A8" />
            <Rect y="132" width="600" height="44" fill="#0038A8" />
            <Rect y="220" width="600" height="44" fill="#0038A8" />
            <Rect y="308" width="600" height="44" fill="#0038A8" />
            <Rect width="220" height="176" fill="#FFFFFF" />
            <Circle cx="110" cy="88" r="40" fill="#F4B400" />
          </Svg>
        </View>
      );

    case '+56': // Chile
      return (
        <View style={[styles.container, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 600 400">
            <Rect width="600" height="200" fill="#FFFFFF" />
            <Rect y="200" width="600" height="200" fill="#D52B1E" />
            <Rect width="200" height="200" fill="#0038A8" />
            <Polygon points="100,50 115,95 160,95 125,120 140,165 100,138 60,165 75,120 40,95 85,95" fill="#FFFFFF" />
          </Svg>
        </View>
      );

    default:
      return (
        <View style={[styles.container, styles.defaultFlag, { width, height, borderRadius }]}>
          <Svg width="100%" height="100%" viewBox="0 0 600 400">
            <Rect width="600" height="400" fill="#3B82F6" />
            <Circle cx="300" cy="200" r="80" fill="#FFFFFF" opacity="0.8" />
          </Svg>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
  defaultFlag: {
    backgroundColor: '#E2E8F0',
  },
});
