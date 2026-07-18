import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useRole } from '../auth/session';
import { AssetsStack, CalendarStack, HomeStack, StaffStack } from './stacks';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

// Role-aware tab set (Feature D): L1 = Home · Assets, L2 adds Calendar and
// Staff. Branching on the effective role makes the L2→L1 toggle swap the set
// live — the router keeps surviving tabs' state, and if the focused tab is
// removed it falls back to the most recently visited surviving one.
export function TabNavigator() {
  const role = useRole();
  if (role === null) return null; // unmounts via the root auth switch

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      <Tab.Screen name="AssetsTab" component={AssetsStack} options={{ title: 'Assets' }} />
      {role === 2 && (
        <>
          <Tab.Screen name="CalendarTab" component={CalendarStack} options={{ title: 'Calendar' }} />
          <Tab.Screen name="StaffTab" component={StaffStack} options={{ title: 'Staff' }} />
        </>
      )}
    </Tab.Navigator>
  );
}
