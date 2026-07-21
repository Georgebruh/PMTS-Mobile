// Radii, spacing, and key element sizes from the mockup.

export const radii = {
  sm: 8, // .code-chip
  md: 12, // .status-tile, .search-field, .filter-btn
  lg: 14, // .btn
  xl: 16, // .asset-card, .info-card, .nav-btn
  sheet: 24, // bottom-sheet top corners (profile menu)
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20, // horizontal screen padding
  xxl: 24,
} as const;

export const sizes = {
  statusTile: 38,
  icon: 22, // .ic
  iconSmall: 18, // .ic.small
  iconInline: 14, // .loc .ic
  navBar: 62, // .nav-pill height / .fab diameter
  button: 50, // .btn
  searchField: 44,
  iconButton: 36, // .icon-btn
  backBtn: 38, // .back-btn (pushed-screen header)
} as const;
