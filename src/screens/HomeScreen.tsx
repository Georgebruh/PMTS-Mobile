import { Pressable, Switch, Text, View } from 'react-native';

import { useRole, useSession } from '../auth/session';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { Screen } from '../components/Screen';
import { theme } from '../theme';

const ROLE_TITLES = {
  1: 'Level 1 — Maintenance Staff',
  2: 'Level 2 — Asset Manager',
} as const;

// Feature B placeholder home: proves the auth switch landed on the right role
// and hosts the L2→L1 toggle + logout. Feature D replaces this with the real
// role-aware tab shell; Feature E fills in the dashboard.
export function HomeScreen() {
  const user = useSession((s) => s.user);
  const actAsL1 = useSession((s) => s.actAsL1);
  const setActAsL1 = useSession((s) => s.setActAsL1);
  const signOut = useSession((s) => s.signOut);
  const role = useRole();

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

      <Pressable
        onPress={signOut}
        style={({ pressed }) => ({
          marginTop: theme.spacing.xxl,
          height: theme.sizes.button,
          borderRadius: theme.radii.lg,
          borderWidth: 1.5,
          borderColor: pressed ? theme.colors.redPressed : theme.colors.redSoft,
          backgroundColor: theme.colors.white,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Text style={{ fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.red }}>
          Log out
        </Text>
      </Pressable>
    </Screen>
  );
}
