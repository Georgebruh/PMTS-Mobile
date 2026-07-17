import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Temporary root screen: WatermelonDB smoke test (write/read/delete round-trip).
type SmokeState =
  | { phase: 'running' }
  | { phase: 'ok'; assetCount: number }
  | { phase: 'failed'; error: string };

export default function App() {
  const [smoke, setSmoke] = useState<SmokeState>({ phase: 'running' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { database } = await import('./src/database/database');
        const assets = database.get('assets');

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

        const assetCount = await assets.query().fetchCount();
        if (!cancelled) setSmoke({ phase: 'ok', assetCount });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        if (!cancelled) setSmoke({ phase: 'failed', error });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PMTS</Text>
      {smoke.phase === 'running' && (
        <Text style={styles.body}>Checking local database…</Text>
      )}
      {smoke.phase === 'ok' && (
        <>
          <Text style={styles.ok}>✓ WatermelonDB OK</Text>
          <Text style={styles.body}>
            Write/read round-trip passed · {smoke.assetCount} asset(s) in mirror
          </Text>
        </>
      )}
      {smoke.phase === 'failed' && (
        <>
          <Text style={styles.fail}>✗ WatermelonDB failed</Text>
          <Text style={styles.body}>{smoke.error}</Text>
          <Text style={styles.hint}>
            WatermelonDB needs a dev build — it cannot run in Expo Go.{'\n'}
            Run: npx expo run:android
          </Text>
        </>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#7E1113',
    marginBottom: 8,
  },
  ok: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E6E42',
  },
  fail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B02A24',
  },
  body: {
    fontSize: 14,
    color: '#7C7373',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#A69D9C',
    textAlign: 'center',
    marginTop: 12,
  },
});
