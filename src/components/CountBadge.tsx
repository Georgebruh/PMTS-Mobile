import { Text, View } from 'react-native';

import { theme } from '../theme';

// The .section-head .count badge.
export function CountBadge({ count }: { count: number }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.redSoft,
        borderRadius: theme.radii.pill,
        paddingVertical: 2,
        paddingHorizontal: 8,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bold,
          fontSize: 11,
          color: theme.colors.maroon,
        }}
      >
        {count}
      </Text>
    </View>
  );
}
