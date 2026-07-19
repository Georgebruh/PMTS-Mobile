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
import { DashboardL1 } from './home/DashboardL1';
import { DashboardL2 } from './home/DashboardL2';
import { DevProbes } from './home/DevProbes';
import { WoPreviewSection } from './home/WoPreviewSection';

const ROLE_TITLES = {
  1: 'Level 1 — Maintenance Staff',
  2: 'Level 2 — Asset Manager',
} as const;

// Home tab's stack screen: the Feature E live dashboard (role-branched) plus
// the session chrome from Feature B (L2→L1 toggle, logout) and Feature C's
// sync status card.
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
      {/* Separate components per role: the Act-as-L1 flip unmounts one tree
          and mounts the other, so every observable re-subscribes under the
          new scope by construction. */}
      {role === 1 ? <DashboardL1 userId={user.id} /> : <DashboardL2 />}
      <WoPreviewSection assignedTo={role === 1 ? user.id : undefined} />

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

      <SectionHead title="Sync" />
      <SyncStatusCard userId={user.id} userEmail={user.email} />
      {__DEV__ && <DevProbes userId={user.id} role={role} />}

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

// Feature C status readout + dev-only write probe. The probe stays until
// Feature C's phase-7 device gate passes (it appends a TEST_SYNC asset_history
// event, append-only and safe to clean from the sheet); retire it then.
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
