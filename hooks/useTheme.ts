import { useColorScheme } from 'react-native';
import { C, R, FONT } from '../constants/theme';

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    C,
    R,
    FONT,
    isDark,
  };
}
