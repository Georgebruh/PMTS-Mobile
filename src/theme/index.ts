import { colors, status, tags } from './colors';
import { radii, sizes, spacing } from './metrics';
import { shadows } from './shadows';
import { fonts, text } from './typography';

export type { StatusColor, TagVariant } from './colors';

export const theme = {
  colors,
  tags,
  status,
  fonts,
  text,
  radii,
  spacing,
  sizes,
  shadows,
} as const;
