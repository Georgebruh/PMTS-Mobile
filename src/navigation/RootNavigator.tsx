import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { flushPendingNavigation } from '../notify/navigation';
import { MaintenanceReportScreen } from '../screens/MaintenanceReportScreen';
import { TagForRepairScreen } from '../screens/TagForRepairScreen';
import { theme } from '../theme';
import { navigationRef } from './navigationRef';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

// Scene background matches the app's, so native-stack transitions and tab
// switches never flash white.
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: theme.colors.bg },
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

// Signed-in navigation root. The auth switch stays in App.tsx: mounting this
// only while signed in means every session starts with fresh navigation state
// (pairs with Feature C's wipe-on-user-switch).
//
// Feature I added the stack layer above the tabs. The maintenance report is
// presented HERE, not inside a tab's stack, because the nav pill and FAB are an
// absolutely-positioned layer the tab navigator draws over everything nested
// inside it — see the note on RootStackParamList.
export function RootNavigator() {
  return (
    // ref + onReady let a notification tap deep-link even when it arrived before
    // any screen was focused — Feature M's cold-start path (see notify/navigation.ts).
    <NavigationContainer theme={navTheme} ref={navigationRef} onReady={flushPendingNavigation}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Tabs" component={TabNavigator} />
        <RootStack.Screen
          name="MaintenanceReport"
          component={MaintenanceReportScreen}
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <RootStack.Screen
          name="TagForRepair"
          component={TagForRepairScreen}
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
