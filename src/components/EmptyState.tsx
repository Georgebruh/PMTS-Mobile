import { Text, View } from 'react-native';

import { theme } from '../theme';
import { Card } from './Card';
import { Icon } from './Icon';
import type { IconName } from './icons';

type Props = {
  title: string;
  caption?: string;
  /**
   * Feature N — an optional glyph above the title, to tell an error or
   * permission-denied empty apart from a plain no-results one. Defaults to
   * undefined (no icon), so every existing call site is unchanged.
   */
  icon?: IconName;
};

// Empty-result card in the WoPreviewSection idiom; shared by the WO List and
// later list screens (G/K/L).
export function EmptyState({ title, caption, icon }: Props) {
  return (
    <Card style={{ padding: theme.spacing.lg, gap: 4 }}>
      {icon !== undefined && (
        <View style={{ marginBottom: 6 }}>
          <Icon name={icon} size={theme.sizes.icon} color={theme.colors.faint} />
        </View>
      )}
      <Text style={theme.text.cardTitle}>{title}</Text>
      {caption !== undefined && <Text style={theme.text.caption}>{caption}</Text>}
    </Card>
  );
}
