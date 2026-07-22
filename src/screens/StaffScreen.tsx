import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { ApprovalCard } from '../components/ApprovalCard';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { SectionHead } from '../components/SectionHead';
import { WorkOrderCard } from '../components/WorkOrderCard';
import type { StaffStackParamList } from '../navigation/types';
import { usePendingApprovals, useUnassignedWos, useUserNames } from '../staff/hooks';
import { nameFor } from '../staff/naming';
import { theme } from '../theme';

type Nav = NativeStackNavigationProp<StaffStackParamList, 'StaffMain'>;

// Feature L — the L2 Staff hub: two queues, each a tappable list.
//
//   Assignment — every unassigned work order → AssignWorkOrder (pick a staff).
//   Approvals  — every submitted report still PENDING → ApprovalDetail (review).
//
// Both queues are small (they drain as the team works), so plain mapped cards
// inside the Screen scroll are right — no FlashList. Counts are the arrays'
// lengths, so the badge and the list physically cannot disagree.
//
// The tab itself only mounts for an effective L2 (TabNavigator) and the local
// mirror is already area-scoped by the server, so — like the Calendar tab —
// there is no client-side lock to re-apply here.
export function StaffScreen() {
  const navigation = useNavigation<Nav>();
  const unassigned = useUnassignedWos();
  const approvals = usePendingApprovals();
  const names = useUserNames();

  return (
    <Screen title="Staff">
      <SectionHead title="Assignment" count={unassigned?.length} />
      {unassigned !== undefined &&
        (unassigned.length === 0 ? (
          <EmptyState
            title="Nothing to assign"
            caption="Unassigned work orders will appear here as they come in."
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {unassigned.map((wo) => (
              <WorkOrderCard
                key={wo.id}
                wo={wo}
                onPress={() => navigation.navigate('AssignWorkOrder', { woId: wo.id })}
              />
            ))}
          </View>
        ))}

      <SectionHead title="Approvals" count={approvals?.length} />
      {approvals !== undefined &&
        (approvals.length === 0 ? (
          <EmptyState
            title="No reports waiting"
            caption="Submitted reports appear here for review before they close."
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {approvals.map((report) => (
              <ApprovalCard
                key={report.id}
                report={report}
                reporterName={nameFor(names, report.reporterUserId)}
                onPress={() => navigation.navigate('ApprovalDetail', { reportId: report.id })}
              />
            ))}
          </View>
        ))}
    </Screen>
  );
}
