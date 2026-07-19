import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AssetListScreen } from '../screens/AssetListScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { StaffScreen } from '../screens/StaffScreen';
import { WorkOrderDetailScreen } from '../screens/WorkOrderDetailScreen';
import { WorkOrderListScreen } from '../screens/WorkOrderListScreen';
import type {
  AssetsStackParamList,
  CalendarStackParamList,
  HomeStackParamList,
  StaffStackParamList,
} from './types';

// One native stack per tab so later features push detail screens while the
// pill + FAB stay visible. Native headers stay hidden everywhere — the Screen
// scaffold is the app's header.
const STACK_OPTIONS = { headerShown: false } as const;

const HomeStackNav = createNativeStackNavigator<HomeStackParamList>();
export function HomeStack() {
  return (
    <HomeStackNav.Navigator screenOptions={STACK_OPTIONS}>
      <HomeStackNav.Screen name="HomeMain" component={HomeScreen} />
      <HomeStackNav.Screen name="WorkOrderList" component={WorkOrderListScreen} />
      <HomeStackNav.Screen name="WorkOrderDetail" component={WorkOrderDetailScreen} />
    </HomeStackNav.Navigator>
  );
}

const AssetsStackNav = createNativeStackNavigator<AssetsStackParamList>();
export function AssetsStack() {
  return (
    <AssetsStackNav.Navigator screenOptions={STACK_OPTIONS}>
      <AssetsStackNav.Screen name="AssetListMain" component={AssetListScreen} />
    </AssetsStackNav.Navigator>
  );
}

const CalendarStackNav = createNativeStackNavigator<CalendarStackParamList>();
export function CalendarStack() {
  return (
    <CalendarStackNav.Navigator screenOptions={STACK_OPTIONS}>
      <CalendarStackNav.Screen name="CalendarMain" component={CalendarScreen} />
    </CalendarStackNav.Navigator>
  );
}

const StaffStackNav = createNativeStackNavigator<StaffStackParamList>();
export function StaffStack() {
  return (
    <StaffStackNav.Navigator screenOptions={STACK_OPTIONS}>
      <StaffStackNav.Screen name="StaffMain" component={StaffScreen} />
    </StaffStackNav.Navigator>
  );
}
