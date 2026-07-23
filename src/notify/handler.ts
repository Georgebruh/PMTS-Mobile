// Feature M — how a notification behaves at the OS boundary.
//
// Foreground policy (locked decision): while the app is in the foreground we do
// NOT pop an OS banner — the in-app bell is the foreground surface. This handler
// only governs notifications that ARRIVE while foregrounded; background/killed
// pushes are drawn by the OS per the channel below and never consult it.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { theme } from '../theme';

/** Call once at app startup (module-safe, like SplashScreen.preventAutoHideAsync). */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      // SDK 57: banner/list replace the deprecated shouldShowAlert. Both false
      // → nothing shows in-foreground; routing.ts feeds the bell instead.
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });
}

/**
 * The Android channel named in app.json (`defaultChannel: "default"`). HIGH so
 * a background push heads-up. Idempotent — Android upserts by channel id — and
 * creating it is also what surfaces the Android 13+ permission prompt.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: theme.colors.red,
  });
}
