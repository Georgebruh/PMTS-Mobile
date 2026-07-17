import {
  Lato_400Regular,
  Lato_700Bold,
  Lato_900Black,
  useFonts,
} from '@expo-google-fonts/lato';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AssetCard } from './src/components/AssetCard';
import { Card } from './src/components/Card';
import { SectionHead } from './src/components/SectionHead';
import { Screen } from './src/components/Screen';
import { theme } from './src/theme';

SplashScreen.preventAutoHideAsync();

// Feature A gate screen: WatermelonDB smoke test (write/read/delete) plus a
// seeded asset rendered as one themed card — the plan's "done when".
type DemoAsset = {
  name: string;
  code: string;
  location: string;
  typeLabel: string;
};

type SmokeState =
  | { phase: 'running' }
  | { phase: 'ok'; assetCount: number; demo: DemoAsset }
  | { phase: 'failed'; error: string };

const DEMO_ASSET_NAME = 'Stormwater Manhole';

async function runSmokeTest(): Promise<{ assetCount: number; demo: DemoAsset }> {
  const { database } = await import('./src/database/database');
  const { Q } = await import('@nozbe/watermelondb');
  const assets = database.get('assets');

  // 1. Write/read/delete round-trip — the device gate.
  await database.write(async () => {
    const probe = await assets.create((a: any) => {
      a.equipmentName = 'DB_SMOKE_PROBE';
    });
    const readBack = await assets.find(probe.id);
    if (readBack.id !== probe.id) {
      throw new Error('probe read-back mismatch');
    }
    await readBack.destroyPermanently();
  });

  // 2. Idempotent seed: find-or-create one demo asset, read it back.
  let seeded = (await assets.query(Q.where('equipment_name', DEMO_ASSET_NAME)).fetch())[0];
  if (!seeded) {
    const created = await database.write(() =>
      assets.create((a: any) => {
        a.assetCode = 'MEZ2-SCD-0126';
        a.equipmentName = DEMO_ASSET_NAME;
        a.equipmentNo = 'SCD-0126';
        a.tier = 2;
        a.site = 'MEZ2';
        a.location = 'Sandugo Street';
        a.code = 'SCD';
        a.assetType = 'Land Development';
        a.currentStatusColor = 'green';
        a.inChargeEmail = '';
        a.active = true;
      }),
    );
    seeded = await assets.find(created.id);
  }

  const s = seeded as any;
  return {
    assetCount: await assets.query().fetchCount(),
    demo: {
      name: s.equipmentName,
      code: s.assetCode,
      location: s.location,
      typeLabel: s.assetType,
    },
  };
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
  });
  const [smoke, setSmoke] = useState<SmokeState>({ phase: 'running' });

  useEffect(() => {
    let cancelled = false;

    runSmokeTest()
      .then((result) => {
        if (!cancelled) setSmoke({ phase: 'ok', ...result });
      })
      .catch((e) => {
        console.error('WatermelonDB smoke test failed:', e);
        const error = e instanceof Error ? e.message : String(e);
        if (!cancelled) setSmoke({ phase: 'failed', error });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Screen
        title="PMTS"
        dateLine="Feature A — foundation gate"
        synced={smoke.phase === 'ok'}
        hasNotifications={smoke.phase === 'failed'}
      >
        <SectionHead title="Database gate" />
        <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 14, gap: 4 }}>
          {smoke.phase === 'running' && (
            <Text style={theme.text.body}>Checking local database…</Text>
          )}
          {smoke.phase === 'ok' && (
            <>
              <Text style={[theme.text.cardTitle, { color: theme.tags.done.text }]}>
                ✓ WatermelonDB OK
              </Text>
              <Text style={theme.text.caption}>
                Write/read round-trip passed · {smoke.assetCount} asset(s) in mirror
              </Text>
            </>
          )}
          {smoke.phase === 'failed' && (
            <>
              <Text style={[theme.text.cardTitle, { color: theme.tags.repair.text }]}>
                ✗ WatermelonDB failed
              </Text>
              <Text style={theme.text.caption}>{smoke.error}</Text>
              <Text style={[theme.text.micro, { color: theme.colors.faint, marginTop: 8 }]}>
                WatermelonDB needs a dev build — it cannot run in Expo Go.{'\n'}
                Run: npx expo run:android
              </Text>
            </>
          )}
        </Card>

        {smoke.phase === 'ok' && (
          <>
            <SectionHead title="Seeded asset" count={1} />
            <View style={{ gap: 10 }}>
              <AssetCard
                name={smoke.demo.name}
                code={smoke.demo.code}
                location={smoke.demo.location}
                typeLabel={smoke.demo.typeLabel}
                status="pending"
                statusLabel="Pending"
              />
            </View>
          </>
        )}
      </Screen>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
