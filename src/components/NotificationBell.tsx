import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { selectOsNotificationsDenied, selectUnreadCount, useNotifStore } from '../notify/store';
import { theme } from '../theme';
import { Icon } from './Icon';
import { NotificationsSheet } from './NotificationsSheet';

/**
 * Header bell — Feature M's in-app surface. Self-mounting from the notification
 * store (the ProfileButton pattern), so every tab screen gets the live dot and
 * the sheet with nothing threaded through Screen's props. Still works when OS
 * notification permission is denied: the sheet opens and lists whatever reached
 * the store; only the OS banners are gone. Feature N adds a small "!" indicator
 * for that denied case, and the sheet explains it with a path to Settings.
 */
export function NotificationBell() {
  const unread = useNotifStore(selectUnreadCount);
  const osDenied = useNotifStore(selectOsNotificationsDenied);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={
          osDenied
            ? 'Notifications — system notifications are turned off'
            : unread > 0
              ? `Notifications — ${unread} unread`
              : 'Notifications'
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
        {osDenied && <PermissionBadge />}
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

// OS notifications denied: a red "!" in the opposite corner from the unread dot,
// so the two never collide. It says "system banners won't arrive"; the sheet
// carries the full explanation and the Settings link.
function PermissionBadge() {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 5,
        right: 5,
        minWidth: 13,
        height: 13,
        paddingHorizontal: 2,
        borderRadius: 6.5,
        backgroundColor: theme.colors.red,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: theme.colors.bg,
      }}
    >
      <Text
        style={{
          color: theme.colors.white,
          fontSize: 9,
          lineHeight: 11,
          fontFamily: theme.fonts.bold,
        }}
      >
        !
      </Text>
    </View>
  );
}
