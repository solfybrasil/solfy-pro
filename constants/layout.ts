import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Baseado no padrão de design comum (iPhone 11/12/13/14)
const baseWidth = 375;
const scale = SCREEN_WIDTH / baseWidth;

export function normalize(size: number) {
  // Adiciona uma trava para não deixar a escala ficar exagerada em telas muito grandes
  const cappedScale = Math.min(scale, 1.2); 
  const newSize = size * cappedScale;
  
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else if (Platform.OS === 'android') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  } else {
    // Para Web, mantemos o tamanho original ou com escala mínima
    return Math.round(newSize);
  }
}

export const device = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: SCREEN_WIDTH < 375,
  isTablet: SCREEN_WIDTH > 600,
  padding: normalize(20),
  radius: normalize(16),
};
