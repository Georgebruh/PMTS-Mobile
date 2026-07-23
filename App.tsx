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
import { ensureAndroidChannel, setupNotificationHandler } from './src/notify/handler';
import { usePushRegistration } from './src/notify/registration';
import { useNotificationRouting } from './src/notify/routing';
import { LoginScreen } from './src/screens/LoginScreen';
import { useSyncLifecycle } from './src/sync/syncManager';

SplashScreen.preventAutoHideAsync();
// Feature M: how a foreground notification behaves (no OS banner — the bell is
// the surface). Module-safe, like preventAutoHideAsync above.
setupNotificationHandler();

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

  // Feature M: register this device's push token while signed in (best-effort),
  // and route notification taps (incl. the cold-start tap) into the app.
  usePushRegistration();
  useNotificationRouting();

  useEffect(() => {
    restore();
    ensureAndroidChannel();
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
