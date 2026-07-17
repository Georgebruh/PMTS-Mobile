import { View } from 'react-native';

import { theme } from '../theme';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type StatusVariant = 'pending' | 'done' | 'repair';

const statusIcon: Record<StatusVariant, IconName> = {
  pending: 'clock',
  done: 'check',
  repair: 'wrench',
};

// Glanceable state tile at the left edge of a card (.status-tile).
export function StatusTile({ variant }: { variant: StatusVariant }) {
  const { bg, text } = theme.tags[variant];
  return (
    <View
      style={{
        width: theme.sizes.statusTile,
        height: theme.sizes.statusTile,
        borderRadius: theme.radii.md,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={statusIcon[variant]} size={19} color={text} strokeWidth={2} />
    </View>
  );
}
