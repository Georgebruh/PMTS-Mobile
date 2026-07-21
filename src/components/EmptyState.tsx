import { Text } from 'react-native';

import { theme } from '../theme';
import { Card } from './Card';

type Props = {
  title: string;
  caption?: string;
};

// Empty-result card in the WoPreviewSection idiom; shared by the WO List and
// later list screens (G/K/L).
export function EmptyState({ title, caption }: Props) {
  return (
    <Card style={{ padding: theme.spacing.lg, gap: 4 }}>
      <Text style={theme.text.cardTitle}>{title}</Text>
      {caption !== undefined && <Text style={theme.text.caption}>{caption}</Text>}
    </Card>
  );
}
