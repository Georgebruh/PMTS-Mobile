import { useRole, useSession } from '../auth/session';
import { Screen } from '../components/Screen';
import { DashboardL1 } from './home/DashboardL1';
import { DashboardL2 } from './home/DashboardL2';
import { DevProbes } from './home/DevProbes';
import { WoPreviewSection } from './home/WoPreviewSection';

// Home tab's stack screen: the Feature E live dashboard (role-branched) and
// nothing else. The session chrome from Feature B (identity, L2→L1 toggle,
// logout) and Feature C's sync card moved to the profile sheet behind the
// header avatar — Home is a work surface, and none of that is work.
export function HomeScreen() {
  const user = useSession((s) => s.user);
  const role = useRole();

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
      {__DEV__ && <DevProbes userId={user.id} role={role} />}
    </Screen>
  );
}
