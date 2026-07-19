import { Q } from '@nozbe/watermelondb';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from 'react-native';

import { useRole, useSession } from '../auth/session';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { Screen } from '../components/Screen';
import { database } from '../database/database';
import { flushAndSignOut, useSyncStatus } from '../sync/syncManager';
import { theme } from '../theme';

const ROLE_TITLES = {
  1: 'Level 1 — Maintenance Staff',
  2: 'Level 2 — Asset Manager',
} as const;

// Home tab's stack screen (re-homed by Feature D's tab shell): hosts the
// L2→L1 toggle + logout. Feature E fills in the real dashboard.
export function HomeScreen() {
  const user = useSession((s) => s.user);
  const actAsL1 = useSession((s) => s.actAsL1);
  const setActAsL1 = useSession((s) => s.setActAsL1);
  const role = useRole();
  const [signingOut, setSigningOut] = useState(false);

  if (!user || role === null) return null; // unmounts via the root switch

  const dateLine = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Screen title="Home" dateLine={dateLine}>
      <SectionHead title="Signed in" />
      <Card style={{ padding: theme.spacing.lg, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Text style={theme.text.cardTitle}>{user.full_name || user.email}</Text>
          {user.is_lead && <Pill variant="type" label="LEAD" />}
        </View>
        <Text style={theme.text.caption}>{user.email}</Text>
        <Text style={theme.text.caption}>
          Area: {user.assigned_area || '—'}
          {user.assigned_locations ? ` · ${user.assigned_locations}` : ''}
        </Text>
        <View style={{ marginTop: 6 }}>
          <Pill
            variant={role === 2 ? 'repair' : 'done'}
            label={ROLE_TITLES[role]}
          />
        </View>
      </Card>

      {user.role_level === 2 && (
        <>
          <SectionHead title="Role" />
          <Card
            style={{
              padding: theme.spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={theme.text.cardTitle}>Act as Level 1</Text>
              <Text style={theme.text.caption}>
                Use the app the way your maintenance staff sees it. Flips every screen without
                logging out.
              </Text>
            </View>
            <Switch
              value={actAsL1}
              onValueChange={setActAsL1}
              trackColor={{ false: theme.colors.line, true: theme.colors.redSoft }}
              thumbColor={actAsL1 ? theme.colors.red : theme.colors.white}
            />
          </Card>
        </>
      )}

      <SectionHead title="Dashboard" />
      <Card style={{ padding: theme.spacing.lg, gap: 4 }}>
        <Text style={theme.text.cardTitle}>
          {role === 1 ? 'Your work orders land here' : 'Your team overview lands here'}
        </Text>
        <Text style={theme.text.caption}>
          {role === 1
            ? "Today's work orders, overdue, and unfinished reports arrive with Feature E."
            : 'Unassigned, assigned, completed, and pending-approval counts arrive with Feature E.'}
        </Text>
      </Card>

      <SectionHead title="Sync" />
      <SyncStatusCard userId={user.id} userEmail={user.email} />

      <Pressable
        onPress={async () => {
          // Pushes queued writes first (best-effort) — the Feature C rule that
          // a later different-user login's wipe can't eat this user's work.
          setSigningOut(true);
          try {
            await flushAndSignOut();
          } finally {
            setSigningOut(false);
          }
        }}
        disabled={signingOut}
        style={({ pressed }) => ({
          marginTop: theme.spacing.xxl,
          height: theme.sizes.button,
          borderRadius: theme.radii.lg,
          borderWidth: 1.5,
          borderColor: pressed ? theme.colors.redPressed : theme.colors.redSoft,
          backgroundColor: theme.colors.white,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: signingOut ? 0.55 : 1,
        })}
      >
        {signingOut ? (
          <ActivityIndicator color={theme.colors.red} />
        ) : (
          <Text style={{ fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.red }}>
            Log out
          </Text>
        )}
      </Pressable>
    </Screen>
  );
}

const PHASE_LABELS = {
  idle: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync failed — retrying',
} as const;

// Feature C status readout + dev-only write probe. The probe is how the
// airplane-mode gate is exercised before Features E–J add real write screens;
// it appends a TEST_SYNC asset_history event (append-only, safe to clean from
// the sheet afterwards). Both retire when the real dashboard lands (Feature E).
function SyncStatusCard({ userId, userEmail }: { userId: string; userEmail: string }) {
  const phase = useSyncStatus((s) => s.phase);
  const pending = useSyncStatus((s) => s.pending);
  const lastSyncedAt = useSyncStatus((s) => s.lastSyncedAt);
  const errorMessage = useSyncStatus((s) => s.errorMessage);

  const statusLine = phase === 'idle' && pending ? 'Changes waiting to sync' : PHASE_LABELS[phase];
  const lastLine = lastSyncedAt
    ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : 'Not synced yet this session';

  const writeTestRow = async () => {
    const assets = await database.get('assets').query(Q.take(1)).fetch();
    if (assets.length === 0) {
      Alert.alert('No assets yet', 'Seed the assets tab in the sheet and sync first.');
      return;
    }
    await database.write(async () => {
      await database.get('asset_history').create((h: any) => {
        h.asset.set(assets[0]);
        h.historyCode = ''; // display codes are server-assigned
        h.eventType = 'TEST_SYNC';
        h.actor = userId;
        h.notes = `dev sync probe from ${userEmail}`;
        h.eventAt = new Date();
      });
    });
    // No manual sync call — the write-batch trigger must pick this up itself.
  };

  return (
    <Card style={{ padding: theme.spacing.lg, gap: 6 }}>
      <Text style={theme.text.cardTitle}>{statusLine}</Text>
      <Text style={theme.text.caption}>{lastLine}</Text>
      {phase === 'error' && errorMessage !== null && (
        <Text style={[theme.text.caption, { color: theme.colors.red }]}>{errorMessage}</Text>
      )}
      {__DEV__ && (
        <Pressable
          onPress={writeTestRow}
          style={({ pressed }) => ({
            marginTop: 6,
            alignSelf: 'flex-start',
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.line,
            backgroundColor: pressed ? theme.colors.bg : theme.colors.white,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 8,
          })}
        >
          <Text style={[theme.text.caption, { color: theme.colors.ink }]}>
            DEV · Write test history row
          </Text>
        </Pressable>
      )}
    </Card>
  );
}
