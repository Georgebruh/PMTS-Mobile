import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '../theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Shared surface of .asset-card / .info-card.
export function Card({ children, style }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.white,
          borderWidth: 1,
          borderColor: theme.colors.line,
          borderRadius: theme.radii.xl,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
