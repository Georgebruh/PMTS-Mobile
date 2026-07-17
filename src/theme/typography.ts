import { Platform, type TextStyle } from 'react-native';

import { colors } from './colors';

// React Native does not synthesize weights: each Lato weight is its own family.
export const fonts = {
  regular: 'Lato_400Regular',
  bold: 'Lato_700Bold',
  black: 'Lato_900Black',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }) as string,
} as const;

// Text presets from the mockup. letterSpacing is px (CSS em values converted
// at the preset's own font size).
export const text = {
  screenTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.maroon,
    letterSpacing: 0.2,
  },
  sectionHead: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 1, // .08em @ 13px
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 19, // 1.25
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.ink,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.muted,
  },
  micro: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.muted,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.faint,
    letterSpacing: 0.44, // .04em @ 11px
  },
  pill: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  cardLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.faint,
    letterSpacing: 1.1, // .1em @ 11px
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;
