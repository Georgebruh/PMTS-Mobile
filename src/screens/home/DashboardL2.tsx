import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { SectionHead } from '../../components/SectionHead';
import { StatCard } from '../../components/StatCard';
import { StatGrid } from '../../components/StatGrid';
import type { HomeStackParamList } from '../../navigation/types';
import { useTodayBounds, useWoCount } from '../../wo/hooks';
import { FILTER_TITLES, type WoListFilter } from '../../wo/queries';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

// L2 dashboard — the manager's board over the whole local mirror (the server
// already area-scoped the pull). Status-card semantics live in
// src/wo/status.ts (Assigned = ASSIGNED + IN_PROGRESS).
export function DashboardL2() {
  const navigation = useNavigation<Nav>();
  const bounds = useTodayBounds();

  const todayFilter = useMemo<WoListFilter>(() => ({ kind: 'today' }), []);
  const unassignedFilter = useMemo<WoListFilter>(() => ({ kind: 'unassigned' }), []);
  const assignedFilter = useMemo<WoListFilter>(() => ({ kind: 'assigned' }), []);
  const completedFilter = useMemo<WoListFilter>(() => ({ kind: 'completed' }), []);
  const pendingFilter = useMemo<WoListFilter>(() => ({ kind: 'pendingApproval' }), []);

  const todayCount = useWoCount(todayFilter, bounds);
  const unassignedCount = useWoCount(unassignedFilter, bounds);
  const assignedCount = useWoCount(assignedFilter, bounds);
  const completedCount = useWoCount(completedFilter, bounds);
  const pendingCount = useWoCount(pendingFilter, bounds);

  const open = (filter: WoListFilter) => navigation.navigate('WorkOrderList', { filter });

  return (
    <>
      <SectionHead title="Dashboard" />
      <StatGrid>
        <StatCard
          label={FILTER_TITLES.today}
          count={todayCount}
          onPress={() => open(todayFilter)}
        />
        <StatCard
          label={FILTER_TITLES.unassigned}
          count={unassignedCount}
          accent
          onPress={() => open(unassignedFilter)}
        />
        <StatCard
          label={FILTER_TITLES.assigned}
          count={assignedCount}
          onPress={() => open(assignedFilter)}
        />
        <StatCard
          label={FILTER_TITLES.completed}
          count={completedCount}
          onPress={() => open(completedFilter)}
        />
        <StatCard
          label={FILTER_TITLES.pendingApproval}
          count={pendingCount}
          onPress={() => open(pendingFilter)}
        />
      </StatGrid>
    </>
  );
}
