import { Q } from '@nozbe/watermelondb';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRole, useSession } from '../auth/session';
import { database } from '../database/database';
import { flushAndSignOut, requestSync, useSyncStatus } from '../sync/syncManager';
import { theme } from '../theme';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Icon } from './Icon';
import { Pill } from './Pill';

const ROLE_TITLES = {
  1: 'Level 1 — Maintenance Staff',
  2: 'Level 2 — Asset Manager',
} as const;

const PHASE_LABELS = {
  idle: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync failed — retrying',
} as const;

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * The account surface behind the header avatar: identity, the L2 act-as-L1
 * toggle, sync status, and logout — all of which used to sit below the Home
 * dashboard. Home is a work surface; none of this is work.
 *
 * A sheet rather than a pushed screen because the content is small and
 * glanceable. The body is a plain component tree, so moving it into a route
 * later (if settings accrete) is a re-parent, not a rewrite.
 */
export function ProfileSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const actAsL1 = useSession((s) => s.actAsL1);
  const setActAsL1 = useSession((s) => s.setActAsL1);
  const role = useRole();
  const [signingOut, setSigningOut] = useState(false);

  if (!user || role === null) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Without this the Android hardware back button ignores the sheet.
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close profile"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(34,31,31,0.38)' }]}
        />

        <View
          style={{
            backgroundColor: theme.colors.bg,
            borderTopLeftRadius: theme.radii.sheet,
            borderTopRightRadius: theme.radii.sheet,
            borderTopWidth: 1,
            borderColor: theme.colors.line,
            maxHeight: '88%',
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.barTrack,
              alignSelf: 'center',
              marginTop: 10,
              marginBottom: 14,
            }}
          />

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.xl,
              paddingBottom: theme.spacing.xl + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingBottom: theme.spacing.lg,
              }}
            >
              <Avatar fullName={user.full_name} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: theme.fonts.bold,
                      fontSize: 17,
                      color: theme.colors.ink,
                      flexShrink: 1,
                    }}
                  >
                    {user.full_name || user.email}
                  </Text>
                  {user.is_lead && <Pill variant="type" label="LEAD" />}
                </View>
                <Text numberOfLines={1} style={theme.text.caption}>
                  {user.email}
                </Text>
              </View>
            </View>

            <Card style={{ paddingHorizontal: theme.spacing.lg }}>
              <MetaRow label="Role">
                <Pill variant={role === 2 ? 'repair' : 'done'} label={ROLE_TITLES[role]} />
              </MetaRow>
              <MetaRow label="Area" divided>
                <Text style={[theme.text.body, { textAlign: 'right' }]}>
                  {user.assigned_area || '—'}
                  {user.assigned_locations ? ` · ${user.assigned_locations}` : ''}
                </Text>
              </MetaRow>
            </Card>

            {user.role_level === 2 && (
              <Card
                style={{
                  marginTop: theme.spacing.md,
                  padding: theme.spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={theme.text.cardTitle}>Act as Level 1</Text>
                  <Text style={theme.text.caption}>
                    Use the app the way your maintenance staff sees it. Flips every screen
                    without logging out.
                  </Text>
                </View>
                <Switch
                  value={actAsL1}
                  onValueChange={setActAsL1}
                  trackColor={{ false: theme.colors.line, true: theme.colors.redSoft }}
                  thumbColor={actAsL1 ? theme.colors.red : theme.colors.white}
                />
              </Card>
            )}

            <SyncCard userId={user.id} userEmail={user.email} />

            <LogOutButton
              signingOut={signingOut}
              onSignOut={async () => {
                setSigningOut(true);
                try {
                  await flushAndSignOut();
                } finally {
                  setSigningOut(false);
                }
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MetaRow({
  label,
  divided,
  children,
}: {
  label: string;
  divided?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderTopWidth: divided ? 1 : 0,
        borderTopColor: theme.colors.lineFaint,
      }}
    >
      <Text style={theme.text.cardLabel}>{label}</Text>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

// Feature C status readout, moved here from the Home body. "Sync now" makes
// the manual trigger discoverable — the header cloud has always been tappable,
// but nothing said so.
function SyncCard({ userId, userEmail }: { userId: string; userEmail: string }) {
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
    <Card style={{ marginTop: theme.spacing.md, padding: theme.spacing.lg, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Icon
          name={phase === 'offline' ? 'cloudoff' : 'cloudcheck'}
          color={
            phase === 'error'
              ? theme.colors.red
              : phase === 'offline'
                ? theme.colors.muted
                : phase === 'syncing' || pending
                  ? theme.colors.ink
                  : theme.colors.syncGreen
          }
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={theme.text.cardTitle}>{statusLine}</Text>
          <Text style={theme.text.caption}>{lastLine}</Text>
        </View>
        <Pressable
          onPress={() => requestSync('profile sheet')}
          disabled={phase === 'syncing'}
          style={({ pressed }) => ({
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.line,
            backgroundColor: pressed ? theme.colors.bg : theme.colors.white,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 8,
            opacity: phase === 'syncing' ? 0.5 : 1,
          })}
        >
          <Text style={[theme.text.caption, { color: theme.colors.ink }]}>Sync now</Text>
        </Pressable>
      </View>

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

/**
 * Confirmed whenever writes are still queued. flushAndSignOut is best-effort —
 * a failed or timed-out flush signs out anyway, and those writes only survive
 * for the *same* user logging back in. On a shared device the next different
 * account wipes them, so the one-tap distance from opening the sheet needs a
 * speed bump that says what is at stake.
 */
function LogOutButton({
  signingOut,
  onSignOut,
}: {
  signingOut: boolean;
  onSignOut: () => Promise<void>;
}) {
  const pending = useSyncStatus((s) => s.pending);

  const press = () => {
    if (!pending) {
      onSignOut();
      return;
    }
    Alert.alert(
      'Log out with unsynced work?',
      'Some changes on this device have not reached the server yet. Logging out tries to push them first — if that fails they are kept only for you, and are erased if someone else logs in on this phone.',
      [
        { text: 'Stay signed in', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: onSignOut },
      ],
    );
  };

  return (
    <Pressable
      onPress={press}
      disabled={signingOut}
      style={({ pressed }) => ({
        marginTop: theme.spacing.xl,
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
  );
}
