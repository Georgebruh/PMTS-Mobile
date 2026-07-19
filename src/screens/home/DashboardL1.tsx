import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { ProgressBlock } from '../../components/ProgressBlock';
import { SectionHead } from '../../components/SectionHead';
import { StatCard } from '../../components/StatCard';
import { StatGrid } from '../../components/StatGrid';
import type { HomeStackParamList } from '../../navigation/types';
import {
  useDraftReportCount,
  useProgressToday,
  useTodayBounds,
  useWoCount,
} from '../../wo/hooks';
import { FILTER_TITLES, type WoListFilter } from '../../wo/queries';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

// L1 dashboard — the lead's personal view: every number is scoped
// assigned_to = me (locked with the client 2026-07-19). Each card's filter
// object feeds BOTH its count hook and its navigate() param, so the number on
// the card and the list it opens cannot drift.
export function DashboardL1({ userId }: { userId: string }) {
  const navigation = useNavigation<Nav>();
  const bounds = useTodayBounds();

  const todayFilter = useMemo<WoListFilter>(
    () => ({ kind: 'today', assignedTo: userId }),
    [userId],
  );
  const overdueFilter = useMemo<WoListFilter>(
    () => ({ kind: 'overdue', assignedTo: userId }),
    [userId],
  );
  const draftsFilter = useMemo<WoListFilter>(
    () => ({ kind: 'myDrafts', reporterId: userId }),
    [userId],
  );

  const todayCount = useWoCount(todayFilter, bounds);
  const overdueCount = useWoCount(overdueFilter, bounds);
  const draftCount = useDraftReportCount(userId);
  const progress = useProgressToday(userId, bounds);

  const open = (filter: WoListFilter) => navigation.navigate('WorkOrderList', { filter });

  return (
    <>
      {progress !== undefined && progress.total > 0 && (
        <ProgressBlock done={progress.done} total={progress.total} />
      )}
      <SectionHead title="Dashboard" />
      <StatGrid>
        <StatCard
          label={FILTER_TITLES.today}
          count={todayCount}
          onPress={() => open(todayFilter)}
        />
        <StatCard
          label={FILTER_TITLES.overdue}
          count={overdueCount}
          accent
          onPress={() => open(overdueFilter)}
        />
        <StatCard
          label={FILTER_TITLES.myDrafts}
          count={draftCount}
          onPress={() => open(draftsFilter)}
        />
      </StatGrid>
    </>
  );
}
