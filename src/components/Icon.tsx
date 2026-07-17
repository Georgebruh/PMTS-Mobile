import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { theme } from '../theme';
import { glyphs, type IconName } from './icons';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

// Mirrors the mockup's .ic class: stroke-drawn, no fill, round caps/joins.
export function Icon({
  name,
  size = theme.sizes.icon,
  color = theme.colors.ink,
  strokeWidth = 1.8,
}: Props) {
  const strokeProps = {
    stroke: color,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {glyphs[name].map((shape, i) => {
        switch (shape.type) {
          case 'path':
            return <Path key={i} d={shape.d} {...strokeProps} />;
          case 'circle':
            return <Circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} {...strokeProps} />;
          case 'rect':
            return (
              <Rect
                key={i}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx={shape.rx}
                {...strokeProps}
              />
            );
        }
      })}
    </Svg>
  );
}
