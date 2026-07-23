import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigateToTarget } from '../notify/navigation';
import { routeFromNotification } from '../notify/route';
import { currentRouteSession } from '../notify/routing';
import {
  formatTimeAgo,
  selectUnreadCount,
  useNotifStore,
  type NotifItem,
} from '../notify/store';
import { requestSync } from '../sync/syncManager';
import { theme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * The bell's surface: this session's notifications, newest first (Feature M's
 * in-app fallback — what catches an event when the OS banner was missed or
 * never allowed). A sheet like ProfileSheet because the content is small and
 * glanceable, and in-memory by design: a restart starts it empty.
 *
 * An item tap goes through the SAME pure router as a real OS tap, so the
 * shared-device guard holds here too: an item minted for another account (or a
 * Staff item while acting as L1) marks itself read but refuses to deep-link.
 */
export function NotificationsSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const items = useNotifStore((s) => s.items);
  const unread = useNotifStore(selectUnreadCount);
  const markRead = useNotifStore((s) => s.markRead);
  const markAllRead = useNotifStore((s) => s.markAllRead);

  const openItem = (item: NotifItem) => {
    markRead(item.id);
    const target = routeFromNotification(item.data, currentRouteSession());
    // Null is a real answer, not a failure — the item stays here, now read,
    // instead of deep-linking somewhere this viewer must not go.
    if (!target) return;
    onClose();
    navigateToTarget(target);
    // Same reason as a real tap: the push often beats this device's own sync,
    // so kick a round for the observe-based detail screen to fill in.
    void requestSync('notification bell');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Without this the Android hardware back button ignores the sheet.
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close notifications"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(34,31,31,0.38)' }]}
        />

        <View
          style={{
            backgroundColor: theme.colors.bg,
            borderTopLeftRadius: theme.radii.sheet,
            borderTopRightRadius: theme.radii.sheet,
            borderTopWidth: 1,
            borderColor: theme.colors.line,
            maxHeight: '88%',
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.barTrack,
              alignSelf: 'center',
              marginTop: 10,
              marginBottom: 14,
            }}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: theme.spacing.xl,
              paddingBottom: theme.spacing.sm,
            }}
          >
            <Text style={{ fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.ink }}>
              Notifications
            </Text>
            {unread > 0 && (
              <Pressable onPress={markAllRead} hitSlop={8} accessibilityRole="button">
                <Text style={[theme.text.caption, { color: theme.colors.red }]}>
                  Mark all read
                </Text>
              </Pressable>
            )}
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.xl,
              paddingBottom: theme.spacing.xl + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
          >
            {items.length === 0 ? (
              <Text
                style={[
                  theme.text.caption,
                  { paddingVertical: theme.spacing.xl, textAlign: 'center' },
                ]}
              >
                Nothing yet. Assignments and approvals that arrive while you are signed in land
                here; the list starts fresh each time the app restarts.
              </Text>
            ) : (
              items.map((item, index) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  divided={index > 0}
                  onPress={() => openItem(item)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function NotificationRow({
  item,
  divided,
  onPress,
}: {
  item: NotifItem;
  divided: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderTopWidth: divided ? 1 : 0,
        borderTopColor: theme.colors.lineFaint,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {/* Transparent when read, so titles stay aligned down the list. */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginTop: 5,
          backgroundColor: item.read ? 'transparent' : theme.colors.notifDot,
        }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={[theme.text.cardTitle, item.read && { color: theme.colors.muted }]}
        >
          {item.title || 'Notification'}
        </Text>
        {item.body !== '' && (
          <Text numberOfLines={2} style={theme.text.caption}>
            {item.body}
          </Text>
        )}
        <Text style={theme.text.caption}>{formatTimeAgo(item.receivedAt, Date.now())}</Text>
      </View>
    </Pressable>
  );
}
