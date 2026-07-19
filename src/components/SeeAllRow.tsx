import { Pressable, Text } from 'react-native';

import { theme } from '../theme';
import { Icon } from './Icon';

// "See all" affordance under the dashboard's work-order preview (net-new —
// the mockup's lists paginate instead).
export function SeeAllRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: theme.spacing.md,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.maroon }}>
        See all
      </Text>
      <Icon
        name="chevright"
        size={theme.sizes.iconInline}
        color={theme.colors.maroon}
        strokeWidth={2.2}
      />
    </Pressable>
  );
}
