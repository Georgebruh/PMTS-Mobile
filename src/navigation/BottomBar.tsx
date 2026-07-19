import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import type { IconName } from '../components/icons';
import { Icon } from '../components/Icon';
import { theme } from '../theme';
import { Fab } from './Fab';
import type { RootTabParamList } from './types';

// Geometry from the mockup's .bottom-bar: pill and FAB float 18px from the
// sides and 20px above the bottom edge (plus the system inset — SDK 57
// Android is edge-to-edge), 14px apart. The FAB (62px) lives in its own
// absolute stack (see Fab.tsx) so the speed-dial backdrop can dim the pill
// without covering the FAB — the pill stops 18 + 62 + 14 = 94px from the
// right to leave its slot.
const EDGE = 18;
const BOTTOM = 20;
const FAB_SLOT = EDGE + theme.sizes.navBar + 14;

const TAB_ICONS: Record<keyof RootTabParamList, IconName> = {
  HomeTab: 'home',
  AssetsTab: 'menu', // the mockup's Assets nav button uses the hamburger glyph
  CalendarTab: 'calendar',
  StaffTab: 'users',
};

// Custom tabBar (Feature D): the mockup's red nav pill. Rendered once by the
// tab navigator after the scene container, so it floats over every pushed
// screen of every nested stack. The root is a full-screen box-none layer —
// touches outside the pill/FAB fall through to the scene below.
export function BottomBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const bottom = BOTTOM + insets.bottom;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={{
          position: 'absolute',
          left: EDGE,
          right: FAB_SLOT,
          bottom,
          height: theme.sizes.navBar,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.red,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 12,
        }}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={{
                width: 46,
                height: 46,
                borderRadius: theme.radii.xl,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isFocused ? theme.colors.maroonDeep : 'transparent',
              }}
            >
              <Icon
                name={TAB_ICONS[route.name as keyof RootTabParamList]}
                size={23}
                color={theme.colors.white}
              />
            </Pressable>
          );
        })}
      </View>

      {/* After the pill so the open dial's backdrop dims it too. */}
      <Fab bottom={bottom} />
    </View>
  );
}
