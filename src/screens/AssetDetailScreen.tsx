import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import { formatDate, relativeDay } from '../asset/format';
import {
  useAreaLock,
  useAsset,
  useAssetHistory,
  useAssetSchedule,
  useAssetWorkOrders,
} from '../asset/hooks';
import { matchesLockJs, type LockRole } from '../asset/lock';
import { scheduleSummary } from '../asset/queries';
import { assetStatusMeta, frequencyLabel } from '../asset/status';
import { useRole, useSession } from '../auth/session';
import { ActionButton, ActionRow } from '../components/ActionRow';
import { AssetStatusPill } from '../components/AssetStatus';
import { DetailHero } from '../components/DetailHero';
import { DetailScreen } from '../components/DetailScreen';
import { EmptyState } from '../components/EmptyState';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { InfoCard, type InfoRowSpec } from '../components/InfoCard';
import { Pill } from '../components/Pill';
import type { AssetsStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useOpenRepairAssetIds, useTodayBounds } from '../wo/hooks';
import { useTagAsset } from '../wo/useTagAsset';

type Props = NativeStackScreenProps<AssetsStackParamList, 'AssetDetail'>;

// Feature G — Asset Detail (+ history). Read-only for BOTH roles: mobile v1
// has no asset editing anywhere, so the mockup's "Edit Asset" button is
// deliberately absent.
export function AssetDetailScreen({ navigation, route }: Props) {
  const { assetId } = route.params;
  const role = useRole();
  const lockRole: LockRole = role === 1 ? 1 : 2;
  const userId = useSession((s) => s.user?.id ?? '');
  const lock = useAreaLock();
  const bounds = useTodayBounds();

  const asset = useAsset(assetId);
  const history = useAssetHistory(assetId);
  const schedule = useAssetSchedule(assetId);
  const workOrders = useAssetWorkOrders(assetId, lockRole, userId);

  // Feature J. The button reports the rule rather than hiding it: an asset with
  // an open repair says so, instead of offering an action that would be refused.
  const openRepairAssets = useOpenRepairAssetIds();
  const { tag, busy } = useTagAsset();
  const alreadyTagged = openRepairAssets?.has(assetId) ?? false;

  // The lock is re-checked HERE too, not just in the list: an L2 who flips to
  // Act-as-L1 while this screen is open must lose an asset outside the L1
  // location lock, and no route param may ever reach past the lock.
  const permitted = asset !== null && asset !== undefined && matchesLockJs(asset, lockRole, lock);

  const summary = scheduleSummary(schedule ?? [], Date.now());
  const nextRelative = relativeDay(summary.next?.dueDate ?? null, bounds.start);

  const overviewRows: InfoRowSpec[] = asset
    ? [
        { label: 'Type', value: asset.assetType || '—' },
        { label: 'Inspection Frequency', value: frequencyLabel(summary.frequency) },
        { label: 'Status', value: assetStatusMeta(asset.currentStatusColor).label },
        // Optional columns render only when the sheet actually carries them.
        ...(asset.equipmentNo ? [{ label: 'Equipment No.', value: asset.equipmentNo }] : []),
        ...(asset.specs ? [{ label: 'Specs', value: asset.specs }] : []),
        ...(asset.healthPct !== null && asset.healthPct !== undefined
          ? [{ label: 'Health', value: `${asset.healthPct}%` }]
          : []),
      ]
    : [];

  // The mockup labels these Street/Estate, which only fits street-level assets;
  // the schema's own names travel better across asset types.
  const locationRows: InfoRowSpec[] = asset
    ? [
        { label: 'Location', value: asset.location || '—' },
        { label: 'Site', value: asset.site || '—' },
      ]
    : [];

  const scheduleRows: InfoRowSpec[] = [
    {
      label: 'Next Inspection',
      value: nextRelative ?? formatDate(summary.next?.dueDate ?? null),
      sub: nextRelative ? formatDate(summary.next?.dueDate ?? null) : null,
      urgent: nextRelative === 'Today',
    },
    {
      // pms_schedule has no "completed" flag, so the latest past due row is the
      // best available stand-in for the last inspection.
      label: 'Last Inspection',
      value: formatDate(summary.last?.dueDate ?? null),
    },
  ];

  const jumpTarget = workOrders && workOrders.length > 0 ? workOrders[0] : null;

  return (
    <DetailScreen title="Asset Detail" onBack={() => navigation.goBack()}>
      {/* Nothing renders until the asset query has emitted once. */}
      {asset !== undefined &&
        (!permitted ? (
          <View style={{ marginTop: theme.spacing.md }}>
            <EmptyState
              icon="warning"
              title={asset === null ? 'Asset not found' : 'Asset unavailable'}
              caption={
                asset === null
                  ? 'It may have been removed by a sync.'
                  : 'This asset is outside your assigned area or locations.'
              }
            />
          </View>
        ) : (
          <>
            <DetailHero
              pills={
                <>
                  {asset.assetType ? <Pill variant="type" label={asset.assetType} /> : null}
                  <AssetStatusPill color={asset.currentStatusColor} />
                </>
              }
              title={asset.equipmentName || 'Asset'}
              code={asset.assetCode || asset.code}
            />

            <InfoCard label="Overview" rows={overviewRows} />
            <InfoCard label="Location" rows={locationRows} />
            <InfoCard label="Schedule" rows={scheduleRows} />

            <ActionRow>
              <ActionButton
                label={alreadyTagged ? 'Repair Requested' : 'Tag for Repair'}
                icon="wrench"
                disabled={alreadyTagged || busy || openRepairAssets === undefined}
                onPress={() => void tag(asset)}
              />
              {jumpTarget !== null && (
                <ActionButton
                  label="View Work Order"
                  icon="chevright"
                  variant="primary"
                  onPress={() =>
                    navigation.navigate('WorkOrderDetail', { woId: jumpTarget.id })
                  }
                />
              )}
            </ActionRow>

            {history !== undefined &&
              (history.length > 0 ? (
                <HistoryTimeline events={history} />
              ) : (
                <View style={{ marginTop: 14 }}>
                  <EmptyState
                    title="No history yet"
                    caption="Inspections, repairs and status changes will appear here."
                  />
                </View>
              ))}

            <Text style={[theme.text.micro, { marginTop: theme.spacing.md }]}>
              Assets are read-only in the mobile app.
            </Text>
          </>
        ))}
    </DetailScreen>
  );
}
