import { DefaultTheme, NavigationContainer } from '@react-navigation/native';

import { theme } from '../theme';
import { TabNavigator } from './TabNavigator';

// Scene background matches the app's, so native-stack transitions and tab
// switches never flash white.
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: theme.colors.bg },
};

// Signed-in navigation root. The auth switch stays in App.tsx: mounting this
// only while signed in means every session starts with fresh navigation state
// (pairs with Feature C's wipe-on-user-switch).
export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <TabNavigator />
    </NavigationContainer>
  );
}
