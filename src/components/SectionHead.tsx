import { Text, View } from 'react-native';

import { theme } from '../theme';
import { CountBadge } from './CountBadge';

type Props = {
  title: string;
  count?: number;
};

// Uppercase list section header (.section-head).
export function SectionHead({ title, count }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginTop: 22,
        marginBottom: theme.spacing.md,
      }}
    >
      <Text style={theme.text.sectionHead}>{title}</Text>
      {count !== undefined && <CountBadge count={count} />}
    </View>
  );
}
