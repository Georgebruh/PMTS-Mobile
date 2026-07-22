import { Pressable, Text, View } from 'react-native';

import { useAsset } from '../asset/hooks';
import { formatDate } from '../asset/format';
import type { ReportRecord } from '../report/types';
import { theme } from '../theme';
import { AssetStatusPill, AssetStatusTile } from './AssetStatus';

type Props = {
  report: ReportRecord;
  /** Resolved by the queue via the id→name map (gap #8) — the report row only
   *  carries reporter_user_id, and there is no @relation to users. */
  reporterName: string;
  onPress: () => void;
};

// The approval-queue row. Report-centric (not work-order-centric like
// WorkOrderCard): the thing the reviewer is triaging is the equipment CONDITION
// the tech reported, so the status colour leads — the tile on the left and the
// pill on the right both render maintenance_reports.status_color through the
// real four-colour palette (green/orange/red/black).
export function ApprovalCard({ report, reporterName, onPress }: Props) {
  // Denormalized asset id, so the name resolves even if the work order row is
  // gone. undefined until the first emission; null when the asset is missing.
  const asset = useAsset(report.asset.id);
  const title = asset === undefined ? '…' : (asset?.equipmentName ?? 'Report');
  const code = asset === undefined ? '' : (asset?.assetCode ?? '');
  const color = report.statusColor ?? '';

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingTop: 14,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: 13,
            backgroundColor: pressed ? theme.colors.bg : theme.colors.white,
            borderWidth: 1,
            borderColor: theme.colors.line,
            borderRadius: theme.radii.xl,
          }}
        >
          <AssetStatusTile color={color} />

          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <Text numberOfLines={1} style={[theme.text.cardTitle, { flexShrink: 1 }]}>
                {title}
              </Text>
              <AssetStatusPill color={color} />
            </View>

            {code ? <Text style={[theme.text.code, { marginTop: 2 }]}>{code}</Text> : null}

            <Text numberOfLines={1} style={[theme.text.caption, { marginTop: 9 }]}>
              Reported by {reporterName}
              {report.submittedAt ? ` · ${formatDate(report.submittedAt)}` : ''}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}
