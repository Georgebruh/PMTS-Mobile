import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { Icon } from './Icon';
import { OfflineBanner } from './OfflineBanner';
import { ProfileButton } from './ProfileButton';
import { SyncIndicator } from './SyncIndicator';

type Props = {
  title: string;
  dateLine?: string;
  /** Shows the notification dot on the bell (Feature M wires the real state). */
  hasNotifications?: boolean;
  /**
   * Default: body is a ScrollView with the standard screen padding. Pass false
   * when the body hosts its own scroll container (e.g. the Asset List's
   * virtualized list) — children then manage horizontal padding and the bottom
   * clearance for the floating nav pill + FAB themselves.
   */
  scroll?: boolean;
  children: ReactNode;
};

// Tab-screen scaffold from the mockup: header (title + live sync indicator +
// bell), offline banner, optional date line, scrollable body. Bottom padding
// leaves room for the floating nav pill + FAB that Feature D adds.
export function Screen({ title, dateLine, hasNotifications, scroll = true, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 26,
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: 6,
        }}
      >
        <Text numberOfLines={1} style={[theme.text.screenTitle, { flexShrink: 1 }]}>
          {title}
        </Text>
        {/* Three items is the ceiling for this header — the gap tightens from
            the mockup's 14 to keep long titles from truncating. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <HeaderIconButton>
            <SyncIndicator />
          </HeaderIconButton>
          <HeaderIconButton>
            <Icon name="bell" />
            {hasNotifications && <NotificationDot />}
          </HeaderIconButton>
          <ProfileButton />
        </View>
      </View>

      <OfflineBanner />

      {dateLine !== undefined && (
        <Text
          style={[theme.text.caption, { paddingTop: 2, paddingHorizontal: theme.spacing.xl }]}
        >
          {dateLine}
        </Text>
      )}

      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xl,
            // Clears the floating nav pill + FAB (62 high, 20 above the system
            // inset) with breathing room on edge-to-edge Android.
            paddingBottom: 128 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </View>
  );
}

function HeaderIconButton({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        width: theme.sizes.iconButton,
        height: theme.sizes.iconButton,
        borderRadius: theme.sizes.iconButton / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
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
