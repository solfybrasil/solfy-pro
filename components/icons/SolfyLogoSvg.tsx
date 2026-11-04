import * as React from 'react';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';

interface SolfyLogoSvgProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function SolfyLogoSvg({
  size = 20,
  color = '#1E3E25',
  accentColor = '#2E5A36',
}: SolfyLogoSvgProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Escudo / Base geométrica moderna Solfy */}
      <Rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="6"
        fill={color}
      />
      {/* Detalhe do teto/pináculo Solfy */}
      <Path
        d="M12 5.5L6.5 9.5V17.5C6.5 18.0523 6.94772 18.5 7.5 18.5H16.5C17.0523 18.5 17.5 18.0523 17.5 17.5V9.5L12 5.5Z"
        fill="#FFFFFF"
        opacity={0.95}
      />
      {/* Linhas de governança / Solfy Folha */}
      <Path
        d="M12 9.5V14.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Path
        d="M9.5 12.5H14.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Ponto de luz superior */}
      <Circle cx="12" cy="7.5" r="0.8" fill={accentColor} />
    </Svg>
  );
}

export default SolfyLogoSvg;
