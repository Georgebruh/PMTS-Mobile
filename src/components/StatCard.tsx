import { Pressable, Text } from 'react-native';

import { theme } from '../theme';

type Props = {
  label: string;
  /** undefined = still subscribing → renders "—", never a fake 0. */
  count: number | undefined;
  /** Attention treatment: the count turns red while it is above zero. */
  accent?: boolean;
  onPress: () => void;
};

// Dashboard count card. Net-new visual — the mockup's Home has no stat cards —
// composed from the card surface + .card-label + the .pct maroon number scale.
export function StatCard({ label, count, accent = false, onPress }: Props) {
  const countColor =
    accent && count !== undefined && count > 0 ? theme.colors.red : theme.colors.ink;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.bg : theme.colors.white,
        borderWidth: 1,
        borderColor: theme.colors.line,
        borderRadius: theme.radii.xl,
        paddingVertical: 14,
        paddingHorizontal: theme.spacing.lg,
        gap: 2,
      })}
    >
      <Text style={{ fontFamily: theme.fonts.bold, fontSize: 28, lineHeight: 34, color: countColor }}>
        {count === undefined ? '—' : count}
      </Text>
      <Text numberOfLines={2} style={theme.text.cardLabel}>
        {label}
      </Text>
    </Pressable>
  );
}
