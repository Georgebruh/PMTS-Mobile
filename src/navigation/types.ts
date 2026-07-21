import type { NavigatorScreenParams } from '@react-navigation/native';

import type { WoListFilter } from '../wo/queries';

// Per-tab stack param lists. Feature D shipped one route per stack; later
// features append their screens here (F/H/I → Home, G → Assets,
// K → Calendar, L → Staff).
export type HomeStackParamList = {
  HomeMain: undefined;
  // Feature E's typed entry into the Work Order List. The filter param stays
  // a plain serializable object; Feature F's screen mutates it in place via
  // setParams when a chip is tapped.
  WorkOrderList: { filter: WoListFilter };
  // Feature F's typed entry into Work Order Detail. The stub screen ships
  // with F; Feature H replaces the screen, not the route.
  WorkOrderDetail: { woId: string };
};

export type AssetsStackParamList = {
  AssetListMain: undefined;
};

export type CalendarStackParamList = {
  CalendarMain: undefined;
};

export type StaffStackParamList = {
  StaffMain: undefined;
};

// Statically lists all four tabs even though Calendar/Staff only mount for
// effective L2 — nothing navigates to them while they're absent.
export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  AssetsTab: NavigatorScreenParams<AssetsStackParamList>;
  CalendarTab: NavigatorScreenParams<CalendarStackParamList>;
  StaffTab: NavigatorScreenParams<StaffStackParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
