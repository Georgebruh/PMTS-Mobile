// Design tokens extracted from pmt-ui-redesign.html (:root block).

export const colors = {
  red: '#E5231B', // primary action red (nav pill, FAB, buttons)
  redSoft: '#F9DEDD',
  redPressed: '#CF1F18', // .btn.primary:hover
  maroon: '#7E1113', // screen titles, emphasis
  maroonDeep: '#651012', // active nav state
  ink: '#221F1F',
  muted: '#7C7373',
  faint: '#A69D9C',
  bg: '#F8F6F5', // screen background
  line: '#EFE9E8',
  lineFaint: '#F4EFEE', // .info-row divider
  white: '#FFFFFF',
  notifDot: '#F5A623',
  syncGreen: '#2E9E4F', // .ic.green (cloud-check when synced)
} as const;

// Tag/pill pairs (background + text), from the mockup's tag tokens.
export const tags = {
  type: { bg: '#E7EFA9', text: '#55611B' }, // e.g. Land Development
  pending: { bg: '#F1EDEC', text: '#6E6564' },
  done: { bg: '#DFF0E3', text: '#2E6E42' },
  repair: { bg: '#F9DEDD', text: '#B02A24' },
} as const;

export type TagVariant = keyof typeof tags;

// Report status palette (maintenance_reports.status_color).
// green/red come straight from the done/repair tag pairs; orange/black are
// derived in the same soft-bg/dark-text style (the mockup does not define them).
export const status = {
  green: { bg: '#DFF0E3', text: '#2E6E42' },
  orange: { bg: '#FBEBD3', text: '#9A6410' },
  red: { bg: '#F9DEDD', text: '#B02A24' },
  black: { bg: '#E9E6E5', text: '#221F1F' },
} as const;

export type StatusColor = keyof typeof status;
