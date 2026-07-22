import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { formatDate, formatDateTime, relativeDay } from '../asset/format';
import { useAreaLock } from '../asset/hooks';
import { matchesLockJs, type LockRole } from '../asset/lock';
import { useRole, useSession } from '../auth/session';
import { ActionButton, ActionRow } from '../components/ActionRow';
import { CrewCard } from '../components/CrewCard';
import { DetailHero } from '../components/DetailHero';
import { DetailScreen } from '../components/DetailScreen';
import { EmptyState } from '../components/EmptyState';
import { InfoCard, type InfoRowSpec } from '../components/InfoCard';
import { Pill } from '../components/Pill';
import { TierBadge } from '../components/TierBadge';
import { useObservable } from '../hooks/useObservable';
import type { HomeStackParamList, RootStackParamList } from '../navigation/types';
import { reportGate } from '../report/actions';
import { useDraftForWo } from '../report/hooks';
import { openOrCreateDraft } from '../report/mutations';
import { theme } from '../theme';
import { woActions, type Viewer } from '../wo/actions';
import { useCrew, useTodayBounds, useWo } from '../wo/hooks';
import { addCrew, completeWork, removeCrew, startWork, type MutationResult } from '../wo/mutations';
import { statusMeta, WO_TYPE_LABELS } from '../wo/status';
import { asSubscribable, type AssetRecord } from '../wo/types';

// The route is registered in BOTH the Home and Assets stacks (Feature G's
// jump-to-WO keeps the user inside the Assets tab). The param shape is
// identical, so typing against Home covers both — as the Feature F stub did.
type Props = NativeStackScreenProps<HomeStackParamList, 'WorkOrderDetail'>;

// Feature H — Work Order Detail. L1 executes (crew, Start, Complete); L2 views.
//
// Two axes, deliberately not conflated:
//   visibility    = the area/location lock, re-applied here off the EFFECTIVE
//                   role exactly as Asset Detail does — an L2 who flips to
//                   Act-as-L1 with this screen open must lose an out-of-location
//                   work order, and a route param must never reach past the lock.
//   actionability = assignment (woActions). An L1 may legitimately VIEW an
//                   in-scope work order belonging to a colleague but can never
//                   act on it.
export function WorkOrderDetailScreen({ navigation, route }: Props) {
  const { woId } = route.params;

  const role = useRole();
  const lockRole: LockRole = role === 1 ? 1 : 2;
  const userId = useSession((s) => s.user?.id ?? '');
  const lock = useAreaLock();
  const bounds = useTodayBounds();

  const wo = useWo(woId);
  const crew = useCrew(woId);
  const draft = useDraftForWo(woId);
  const [busy, setBusy] = useState(false);

  // The report is presented ABOVE the tab navigator (Feature I), so it is
  // reached through the root navigator rather than this screen's stack — which
  // is also why it works identically from the Home and Assets registrations.
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Live asset name — the same relation observe the list rows use, so an asset
  // renamed by a sync updates this screen without a refetch.
  const asset = useObservable<AssetRecord | null>(
    () =>
      wo
        ? asSubscribable<AssetRecord | null>(wo.asset.observe())
        : // No work order yet (or it is gone): a stream that never emits keeps
          // `asset` at undefined instead of forcing a conditional hook call.
          { subscribe: () => ({ unsubscribe: () => {} }) },
    [wo?.id],
  );

  const viewer: Viewer = { role: lockRole, userId };
  const permitted = wo !== null && wo !== undefined && matchesLockJs(wo, lockRole, lock);
  const actions = permitted && wo ? woActions(wo, viewer) : null;

  // Reporting has its own gate (COMPLETED, mine, effective L1) — deliberately
  // not folded into woActions, which governs Start/Complete/crew.
  const canReport = permitted && wo ? reportGate(wo, viewer).canFile : false;

  const runAction = async (
    action: () => Promise<MutationResult>,
    failTitle: string,
    onSuccess?: () => void,
  ) => {
    if (busy) return; // a double tap must not run the mutation twice
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      Alert.alert(failTitle, result.error);
      return;
    }
    onSuccess?.();
  };

  const onStart = () => runAction(() => startWork(woId, viewer), 'Cannot start work');

  /**
   * Opens the maintenance report, creating the draft if there is none. Safe to
   * tap twice: openOrCreateDraft reopens the existing draft rather than filing
   * a second report against the same work order.
   */
  const openReport = async () => {
    if (busy) return;
    setBusy(true);
    const result = await openOrCreateDraft(woId, viewer);
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Cannot open the report', result.error);
      return;
    }
    rootNavigation.navigate('MaintenanceReport', { reportId: result.reportId });
  };

  // Complete is confirmed because it ends the job and stamps an irreversible
  // timestamp — there is no un-complete. Start is not: it is the expected next
  // action on an assigned work order, and confirming both would only train
  // people to tap through the dialog.
  const onComplete = () =>
    Alert.alert('Complete this work order?', 'This records the time work ended.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        // Straight into the report: completing is the moment the tech has the
        // details in their head and is still standing at the equipment.
        onPress: () => runAction(() => completeWork(woId, viewer), 'Cannot complete work', openReport),
      },
    ]);

  const dueRelative = wo ? relativeDay(wo.dueDate, bounds.start) : null;

  const woRows: InfoRowSpec[] = wo
    ? [
        { label: 'Type', value: WO_TYPE_LABELS[wo.woType] ?? (wo.woType || '—') },
        { label: 'Status', value: statusMeta(wo.status).label },
        {
          label: 'Due',
          value: dueRelative ?? formatDate(wo.dueDate),
          sub: dueRelative ? formatDate(wo.dueDate) : null,
          urgent: dueRelative === 'Today',
        },
        // Timestamps appear only once they exist, so an unstarted work order
        // does not show a column of em dashes.
        ...(wo.startedAt ? [{ label: 'Started', value: formatDateTime(wo.startedAt) }] : []),
        ...(wo.endedAt ? [{ label: 'Ended', value: formatDateTime(wo.endedAt) }] : []),
      ]
    : [];

  const assetRows: InfoRowSpec[] = wo
    ? [
        { label: 'Asset', value: asset === undefined ? '…' : (asset?.equipmentName ?? '—') },
        { label: 'Asset Code', value: asset === undefined ? '…' : (asset?.assetCode ?? '—') },
        { label: 'Location', value: wo.location || '—' },
        { label: 'Site', value: wo.site || '—' },
      ]
    : [];

  return (
    <DetailScreen title="Work Order" onBack={() => navigation.goBack()}>
      {/* Nothing renders before the work order query has emitted once. */}
      {wo !== undefined &&
        (!permitted ? (
          <View style={{ marginTop: theme.spacing.md }}>
            <EmptyState
              title={wo === null ? 'Work order not found' : 'Work order unavailable'}
              caption={
                wo === null
                  ? 'It may have been removed by a sync.'
                  : 'This work order is outside your assigned area or locations.'
              }
            />
          </View>
        ) : (
          <>
            <DetailHero
              pills={
                <>
                  <Pill variant={statusMeta(wo.status).pill} label={statusMeta(wo.status).label} />
                  <TierBadge tier={wo.tier} />
                </>
              }
              title={
                asset === undefined ? '…' : asset?.equipmentName || wo.woCode || 'Work order'
              }
              code={wo.woCode}
            />

            <InfoCard label="Work Order" rows={woRows} />
            <InfoCard label="Asset" rows={assetRows} />

            {crew !== undefined && (
              <CrewCard
                crew={crew}
                editable={actions?.canEditCrew === true && !busy}
                onAdd={async (name) => {
                  const result = await addCrew(woId, name, viewer);
                  return result.ok ? null : result.error;
                }}
                onRemove={async (crewId) => {
                  const result = await removeCrew(crewId);
                  return result.ok ? null : result.error;
                }}
              />
            )}

            {(actions?.canStart === true ||
              actions?.canComplete === true ||
              canReport) && (
              <ActionRow>
                {actions?.canStart && (
                  <ActionButton
                    label="Start Work"
                    icon="clock"
                    variant="primary"
                    onPress={onStart}
                    disabled={busy}
                  />
                )}
                {actions?.canComplete && (
                  <ActionButton
                    label="Complete Work"
                    icon="check"
                    variant="primary"
                    onPress={onComplete}
                    disabled={busy}
                  />
                )}
                {/* The work is done and the report is not filed. A draft in
                    progress says "Continue" — this is the landing point for the
                    dashboard's Unfinished Reports card. */}
                {canReport && (
                  <ActionButton
                    label={draft ? 'Continue Report' : 'File Report'}
                    icon="pencil"
                    variant="primary"
                    onPress={openReport}
                    disabled={busy}
                  />
                )}
              </ActionRow>
            )}

            {actions !== null && actions.blockedReason !== null && (
              <Text style={[theme.text.micro, { marginTop: theme.spacing.md }]}>
                {actions.blockedReason}
              </Text>
            )}
          </>
        ))}
    </DetailScreen>
  );
}
