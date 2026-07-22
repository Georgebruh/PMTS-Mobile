import type { IconName } from '../components/icons';
import type { StatusColor } from '../theme';

// Assets carry a status COLOR (assets.current_status_color: green/orange/red/
// black), not a work-order status string. Unlike the WO status→tag mapping,
// the theme already defines all four colors (theme.status), so the asset pill
// and tile render the real four-colour palette — including black — directly.
// Labels locked 2026-07-21: Healthy / Warning / For Repair / Down.

export type AssetStatusMeta = {
  label: string;
  /** key into theme.status (green/orange/red/black) — bg + text pair. */
  color: StatusColor;
  /** glyph shown in the left status tile. */
  icon: IconName;
};

const META: Record<string, AssetStatusMeta> = {
  green: { label: 'Healthy', color: 'green', icon: 'check' },
  orange: { label: 'Warning', color: 'orange', icon: 'clock' },
  red: { label: 'For Repair', color: 'red', icon: 'wrench' },
  black: { label: 'Down', color: 'black', icon: 'wrench' },
};

// Rows synced from a hand-edited sheet can carry any string — render them
// legibly (dark/neutral) instead of crashing on an unknown colour.
export function assetStatusMeta(color: string): AssetStatusMeta {
  return (
    META[(color || '').trim().toLowerCase()] ?? {
      label: color || 'Unknown',
      color: 'black',
      icon: 'clock',
    }
  );
}

// PMS frequency codes (pms_schedule.frequency_type) → human labels.
export const FREQUENCY_LABELS: Record<string, string> = {
  D: 'Daily',
  W: 'Weekly',
  M: 'Monthly',
  Q: 'Quarterly',
  SA: 'Semi-Annual',
  A: 'Annual',
};

export function frequencyLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return FREQUENCY_LABELS[code.trim().toUpperCase()] ?? code;
}
