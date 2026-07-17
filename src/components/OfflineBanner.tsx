import { Text, View } from 'react-native';

import { useSyncStatus } from '../sync/syncManager';
import { theme } from '../theme';

// Slim strip under the header while the device is offline (Feature C).
// Reassures rather than alarms: offline is a normal state in the field.
export function OfflineBanner() {
  const phase = useSyncStatus((s) => s.phase);
  const pending = useSyncStatus((s) => s.pending);

  if (phase !== 'offline') return null;

  return (
    <View
      style={{
        marginHorizontal: theme.spacing.xl,
        marginTop: theme.spacing.sm,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.ink,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 8,
      }}
    >
      <Text style={[theme.text.caption, { color: theme.colors.white }]}>
        Offline — {pending ? 'your changes will sync when you reconnect.' : 'showing saved data.'}
      </Text>
    </View>
  );
}
