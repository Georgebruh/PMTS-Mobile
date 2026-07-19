import { Text, View } from 'react-native';

import { theme } from '../theme';

// Tier chip for work-order rows (net-new — no mockup design). Deliberately
// quieter than the status pill: the tier drives sort order, not urgency.
export function TierBadge({ tier }: { tier: number }) {
  return (
    <View
      style={{
        height: 20,
        paddingHorizontal: 7,
        borderRadius: theme.radii.sm,
        borderWidth: 1,
        borderColor: theme.colors.line,
        backgroundColor: theme.colors.lineFaint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: theme.fonts.bold, fontSize: 10.5, color: theme.colors.muted }}>
        T{tier}
      </Text>
    </View>
  );
}
