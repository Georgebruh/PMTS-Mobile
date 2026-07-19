import type { NavigatorScreenParams } from '@react-navigation/native';

// Per-tab stack param lists. Feature D ships one route per stack; later
// features append their screens here (E/F/H/I → Home, G → Assets,
// K → Calendar, L → Staff).
export type HomeStackParamList = {
  HomeMain: undefined;
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
