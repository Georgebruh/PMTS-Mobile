import { colors, status, tags } from './colors';
import { radii, sizes, spacing } from './metrics';
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
} as const;
