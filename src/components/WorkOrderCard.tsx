import { Pressable, Text, View } from 'react-native';

import { useObservable } from '../hooks/useObservable';
import { theme } from '../theme';
import { statusMeta, WO_TYPE_LABELS } from '../wo/status';
import { asSubscribable, type AssetRecord, type WoRecord } from '../wo/types';
import { Icon } from './Icon';
import { Pill } from './Pill';
import { StatusTile } from './StatusTile';
import { TierBadge } from './TierBadge';

type Props = {
  wo: WoRecord;
  /** Wired by Feature F's list; the dashboard preview renders without it. */
  onPress?: () => void;
};

// Work-order row with the mockup's .asset-card anatomy: status tile, title,
// code, location — plus the WO-specific status pill, type pill, and tier
// badge. Reused as Feature F's list row.
export function WorkOrderCard({ wo, onPress }: Props) {
  const meta = statusMeta(wo.status);

  // Per-row relation observation: the title is the live asset name, so a
  // renamed asset syncing in updates every visible card without a refetch.
  const asset = useObservable(
    () => asSubscribable<AssetRecord | null>(wo.asset.observe()),
    [wo.id],
  );
  const title =
    asset === undefined ? '…' : asset ? asset.equipmentName : wo.woCode || 'Work order';

  return (
    <Pressable onPress={onPress} disabled={onPress === undefined}>
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
            ...theme.shadows.card,
          }}
        >
          <StatusTile variant={meta.tile} />

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
              <Pill variant={meta.pill} label={meta.label} />
            </View>

            <Text style={[theme.text.code, { marginTop: 2 }]}>{wo.woCode || '—'}</Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 10,
                marginTop: 9,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  flexShrink: 1,
                }}
              >
                <Icon name="pin" size={theme.sizes.iconInline} color={theme.colors.faint} />
                <Text numberOfLines={1} style={theme.text.caption}>
                  {wo.location || '—'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pill variant="type" label={WO_TYPE_LABELS[wo.woType] ?? wo.woType} />
                <TierBadge tier={wo.tier} />
              </View>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}
