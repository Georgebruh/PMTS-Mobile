import { Pressable, ScrollView, Text } from 'react-native';

import { theme } from '../theme';

export type ChipItem<K extends string = string> = {
  key: K;
  label: string;
};

type Props<K extends string> = {
  chips: readonly ChipItem<K>[];
  /** null → no chip highlighted (e.g. a filter whose chip isn't offered). */
  activeKey: K | null;
  onSelect: (key: K) => void;
};

// Horizontally scrollable filter-chip row. Net-new visual (the mockup has no
// chip design): pill geometry from the tag pills, active state in the nav
// pill's maroonDeep, inactive as a bordered white surface.
export function FilterChips<K extends string>({ chips, activeKey, onSelect }: Props<K>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: 2, // keeps pressed-state edges unclipped
      }}
      style={{ flexGrow: 0 }}
    >
      {chips.map((chip) => {
        const active = chip.key === activeKey;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onSelect(chip.key)}
            style={({ pressed }) => ({
              height: 34,
              borderRadius: theme.radii.pill,
              paddingHorizontal: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? theme.colors.maroonDeep : theme.colors.white,
              borderWidth: 1,
              borderColor: active ? theme.colors.maroonDeep : theme.colors.line,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: theme.fonts.bold,
                fontSize: 12,
                color: active ? theme.colors.white : theme.colors.muted,
              }}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
