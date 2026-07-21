import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { Icon } from './Icon';
import { OfflineBanner } from './OfflineBanner';

type Props = {
  title: string;
  onBack: () => void;
  /**
   * Default: body is a ScrollView with the standard screen padding. Pass
   * false when the body hosts its own scroll container (e.g. a virtualized
   * list) — children then manage horizontal padding and the bottom clearance
   * for the floating nav pill + FAB themselves.
   */
  scroll?: boolean;
  children: ReactNode;
};

// Pushed-screen scaffold from the mockup's .detail-top: round back button,
// uppercase bar title, balancing spacer — no sync icon/bell (those live on
// tab screens only). Used by the WO List; Features G/H reuse it for details.
export function DetailScreen({ title, onBack, scroll = true, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 22,
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: 6,
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => ({
            width: theme.sizes.backBtn,
            height: theme.sizes.backBtn,
            borderRadius: theme.sizes.backBtn / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.white,
            borderWidth: 1,
            borderColor: theme.colors.line,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon
            name="chevleft"
            size={theme.sizes.iconSmall}
            color={theme.colors.maroon}
            strokeWidth={2.2}
          />
        </Pressable>

        <Text numberOfLines={1} style={theme.text.barTitle}>
          {title}
        </Text>

        <View style={{ width: theme.sizes.backBtn }} />
      </View>

      <OfflineBanner />

      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xl,
            // Clears the floating nav pill + FAB, matching the Screen scaffold.
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
