import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

// A ref to the root NavigationContainer so code OUTSIDE the React tree — a
// notification tap handler firing before any screen has focus, or a cold-start
// deep link — can navigate. RootNavigator attaches this and flushes any queued
// target from its onReady (see notify/navigation.ts).
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
