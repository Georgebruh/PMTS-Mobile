import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { formatDate } from '../asset/format';
import { useAsset } from '../asset/hooks';
import { useRole, useSession } from '../auth/session';
import { ActionButton, ActionRow } from '../components/ActionRow';
import { DetailHero } from '../components/DetailHero';
import { DetailScreen } from '../components/DetailScreen';
import { EmptyState } from '../components/EmptyState';
import { InfoCard, type InfoRowSpec } from '../components/InfoCard';
import { Pill } from '../components/Pill';
import { StaffPicker } from '../components/StaffPicker';
import { TierBadge } from '../components/TierBadge';
import type { StaffStackParamList } from '../navigation/types';
import { assignGate } from '../staff/assign';
import { useEligibleStaff, useUserNames } from '../staff/hooks';
import { nameFor } from '../staff/naming';
import { useAssign } from '../staff/useStaffActions';
import { theme } from '../theme';
import type { Viewer } from '../wo/actions';
import { useWo } from '../wo/hooks';
import { statusMeta, WO_TYPE_LABELS } from '../wo/status';

type Props = NativeStackScreenProps<StaffStackParamList, 'AssignWorkOrder'>;

// Feature L — pick a maintenance staff for one work order (assign, or reassign
// before work starts). The picker is the confirmation; assignGate decides
// whether the button appears at all, re-evaluated live as the row syncs.
export function AssignWorkOrderScreen({ navigation, route }: Props) {
  const { woId } = route.params;

  const role = useRole();
  const userId = useSession((s) => s.user?.id ?? '');
  const viewer: Viewer = { role: role === 1 ? 1 : 2, userId };

  const wo = useWo(woId);
  const asset = useAsset(wo ? wo.asset.id : '');
  const staff = useEligibleStaff(wo);
  const names = useUserNames();
  const { assign, busy } = useAssign();

  const [pickerOpen, setPickerOpen] = useState(false);

  const gate = wo ? assignGate(wo, viewer) : null;
  const isReassign = !!wo && wo.assignedTo !== null && wo.assignedTo !== '';

  const rows: InfoRowSpec[] = wo
    ? [
        { label: 'Type', value: WO_TYPE_LABELS[wo.woType] ?? (wo.woType || '—') },
        { label: 'Status', value: statusMeta(wo.status).label },
        { label: 'Due', value: formatDate(wo.dueDate) },
        { label: 'Site', value: wo.site || '—' },
        { label: 'Location', value: wo.location || '—' },
        ...(isReassign
          ? [{ label: 'Assigned to', value: nameFor(names, wo!.assignedTo) }]
          : []),
      ]
    : [];

  const onPick = async (staffId: string) => {
    setPickerOpen(false);
    const ok = await assign(woId, staffId);
    if (ok) navigation.goBack();
  };

  return (
    <DetailScreen title="Assign Work Order" onBack={() => navigation.goBack()}>
      {wo !== undefined &&
        (wo === null ? (
          <View style={{ marginTop: theme.spacing.md }}>
            <EmptyState
              title="Work order not found"
              caption="It may have been removed or reassigned by a sync."
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
              title={asset === undefined ? '…' : asset?.equipmentName || wo.woCode || 'Work order'}
              code={wo.woCode}
            />

            <InfoCard label="Work Order" rows={rows} />

            {gate?.canAssign ? (
              <ActionRow>
                <ActionButton
                  label={isReassign ? 'Reassign' : 'Assign to staff'}
                  icon="users"
                  variant="primary"
                  onPress={() => setPickerOpen(true)}
                  disabled={busy || staff === undefined}
                />
              </ActionRow>
            ) : (
              gate?.blockedReason && (
                <Text style={[theme.text.micro, { marginTop: theme.spacing.md }]}>
                  {gate.blockedReason}
                </Text>
              )
            )}

            <StaffPicker
              visible={pickerOpen}
              staff={staff ?? []}
              currentAssigneeId={wo.assignedTo}
              onPick={onPick}
              onClose={() => setPickerOpen(false)}
              busy={busy}
            />
          </>
        ))}
    </DetailScreen>
  );
}
