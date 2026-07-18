import {
  Lato_400Regular,
  Lato_700Bold,
  Lato_900Black,
  useFonts,
} from '@expo-google-fonts/lato';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSession } from './src/auth/session';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { useSyncLifecycle } from './src/sync/syncManager';

SplashScreen.preventAutoHideAsync();

// Root auth switch (Feature B). Kept as a plain conditional: mounting the
// navigation tree (Feature D) only while signed in gives each session fresh
// nav state. The splash screen covers both font loading and the SecureStore
// session restore, so cold start lands directly on the right screen with no
// login flash.
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
  });
  const status = useSession((s) => s.status);
  const restore = useSession((s) => s.restore);

  // Feature C: sync on sign-in/app open, foreground, local writes, interval,
  // reconnect — active only while signed in.
  useSyncLifecycle();

  useEffect(() => {
    restore();
  }, [restore]);

  const ready = (fontsLoaded || fontError != null) && status !== 'restoring';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      {status === 'signedIn' ? <RootNavigator /> : <LoginScreen />}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
