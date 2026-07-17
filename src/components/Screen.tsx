import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { Icon } from './Icon';

type Props = {
  title: string;
  dateLine?: string;
  /** Renders the sync cloud-check green (Feature C wires the real state). */
  synced?: boolean;
  /** Shows the notification dot on the bell (Feature M wires the real state). */
  hasNotifications?: boolean;
  children: ReactNode;
};

// Tab-screen scaffold from the mockup: header (title + sync + bell), optional
// date line, scrollable body. Bottom padding leaves room for the floating nav
// pill + FAB that Feature D adds.
export function Screen({ title, dateLine, synced, hasNotifications, children }: Props) {
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
        <Text style={theme.text.screenTitle}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <HeaderIconButton>
            <Icon
              name="cloudcheck"
              color={synced ? theme.colors.syncGreen : theme.colors.ink}
            />
          </HeaderIconButton>
          <HeaderIconButton>
            <Icon name="bell" />
            {hasNotifications && <NotificationDot />}
          </HeaderIconButton>
        </View>
      </View>

      {dateLine !== undefined && (
        <Text
          style={[theme.text.caption, { paddingTop: 2, paddingHorizontal: theme.spacing.xl }]}
        >
          {dateLine}
        </Text>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: 128,
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
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
