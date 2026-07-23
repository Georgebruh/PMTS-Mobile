import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import { useAsset } from '../asset/hooks';
import { useRole, useSession } from '../auth/session';
import { ActionButton, ActionRow } from '../components/ActionRow';
import { DetailHero } from '../components/DetailHero';
import { DetailScreen } from '../components/DetailScreen';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Pill } from '../components/Pill';
import { ReportReview } from '../components/ReportReview';
import { TierBadge } from '../components/TierBadge';
import type { StaffStackParamList } from '../navigation/types';
import { useReport, useReportParams } from '../report/hooks';
import { approvalGate } from '../staff/approval';
import { useUserNames } from '../staff/hooks';
import { nameFor } from '../staff/naming';
import { useApprove } from '../staff/useStaffActions';
import { theme } from '../theme';
import type { Viewer } from '../wo/actions';
import { useWo } from '../wo/hooks';
import { statusMeta } from '../wo/status';

type Props = NativeStackScreenProps<StaffStackParamList, 'ApprovalDetail'>;

// Feature L — L2 reviews one submitted report and decides. Approve (green
// closes, non-green spawns rework) or Send back (revision). The app only
// records the decision; the gateway's reconcileApprovals_ does the rest, so
// this screen's job is to present the report faithfully and gate the buttons.
export function ApprovalDetailScreen({ navigation, route }: Props) {
  const { reportId } = route.params;

  const role = useRole();
  const userId = useSession((s) => s.user?.id ?? '');
  const viewer: Viewer = { role: role === 1 ? 1 : 2, userId };

  const report = useReport(reportId);
  const wo = useWo(report ? report.workOrder.id : '');
  const params = useReportParams(reportId);
  const asset = useAsset(report ? report.asset.id : '');
  const names = useUserNames();
  const { review, busy } = useApprove();

  const gate = report && wo ? approvalGate(report, wo, viewer) : null;

  const decide = async (decision: 'approve' | 'reject') => {
    if (!report) return;
    const ok = await review(reportId, decision, report.statusColor);
    if (ok) navigation.goBack();
  };

  return (
    <DetailScreen title="Review Report" onBack={() => navigation.goBack()}>
      {report === undefined && (
        <View style={{ marginTop: theme.spacing.md }}>
          <LoadingState caption="Loading report…" />
        </View>
      )}
      {report !== undefined &&
        (report === null ? (
          <View style={{ marginTop: theme.spacing.md }}>
            <EmptyState
              icon="warning"
              title="Report not found"
              caption="It may have been removed or already closed by a sync."
            />
          </View>
        ) : (
          <>
            <DetailHero
              pills={
                wo ? (
                  <>
                    <Pill variant={statusMeta(wo.status).pill} label={statusMeta(wo.status).label} />
                    <TierBadge tier={wo.tier} />
                  </>
                ) : (
                  <View />
                )
              }
              title={asset === undefined ? '…' : asset?.equipmentName || 'Report'}
              code={wo?.woCode || asset?.assetCode || null}
            />

            <ReportReview
              report={report}
              params={params ?? []}
              reporterName={nameFor(names, report.reporterUserId)}
            />

            {gate?.canReview ? (
              <ActionRow>
                <ActionButton
                  label="Approve"
                  icon="check"
                  variant="primary"
                  onPress={() => decide('approve')}
                  disabled={busy}
                />
                <ActionButton
                  label="Send Back"
                  icon="close"
                  variant="ghost"
                  onPress={() => decide('reject')}
                  disabled={busy}
                />
              </ActionRow>
            ) : (
              gate?.blockedReason && (
                <Text style={[theme.text.micro, { marginTop: theme.spacing.md }]}>
                  {gate.blockedReason}
                </Text>
              )
            )}
          </>
        ))}
    </DetailScreen>
  );
}
