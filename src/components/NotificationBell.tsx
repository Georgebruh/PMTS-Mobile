import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { selectUnreadCount, useNotifStore } from '../notify/store';
import { theme } from '../theme';
import { Icon } from './Icon';
import { NotificationsSheet } from './NotificationsSheet';

/**
 * Header bell — Feature M's in-app surface. Self-mounting from the notification
 * store (the ProfileButton pattern), so every tab screen gets the live dot and
 * the sheet with nothing threaded through Screen's props. Still works when OS
 * notification permission is denied: the sheet opens and lists whatever reached
 * the store; only the OS banners are gone.
 */
export function NotificationBell() {
  const unread = useNotifStore(selectUnreadCount);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'
        }
        style={({ pressed }) => ({
          width: theme.sizes.iconButton,
          height: theme.sizes.iconButton,
          borderRadius: theme.sizes.iconButton / 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon name="bell" />
        {unread > 0 && <NotificationDot />}
      </Pressable>

      <NotificationsSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function NotificationDot() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 7,
        right: 8,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: theme.colors.notifDot,
        borderWidth: 1.5,
        borderColor: theme.colors.bg,
      }}
    />
  );
}
