import { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';

import { requestSync, useSyncStatus } from '../sync/syncManager';
import { theme } from '../theme';
import { Icon } from './Icon';
import type { IconName } from './icons';

// The design's header cloud-check, made live (Feature C). States:
//   green check    — synced, nothing waiting
//   ink check      — local writes waiting to push (or a sync underway, pulsing)
//   ink slash      — offline
//   red check      — last sync failed (backoff retry is scheduled)
// Tapping it always requests a manual sync.
export function SyncIndicator() {
  const phase = useSyncStatus((s) => s.phase);
  const pending = useSyncStatus((s) => s.pending);

  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase !== 'syncing') {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 450, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [phase, opacity]);

  let name: IconName = 'cloudcheck';
  let color: string = theme.colors.syncGreen;
  if (phase === 'offline') {
    name = 'cloudoff';
    color = theme.colors.muted;
  } else if (phase === 'error') {
    color = theme.colors.red;
  } else if (phase === 'syncing' || pending) {
    color = theme.colors.ink;
  }

  return (
    <Pressable onPress={() => requestSync('manual')} hitSlop={8}>
      <Animated.View style={{ opacity }}>
        <Icon name={name} color={color} />
      </Animated.View>
    </Pressable>
  );
}
