import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { AssetRecord } from '../asset/types';
import { theme } from '../theme';
import { AssetStatusPill, AssetStatusTile } from './AssetStatus';
import { Icon } from './Icon';
import { Pill } from './Pill';
import { TierBadge } from './TierBadge';

type Props = {
  asset: AssetRecord;
  onPress?: () => void;
  /**
   * Why this row cannot be chosen (Feature J's tag picker: the asset already
   * carries an open repair work order). Dims the row and prints the reason —
   * the rule is much kinder shown up front than as a refusal after the tap.
   */
  unavailableNote?: string | null;
  /**
   * Feature N — the row's content fingerprint (its updated_at in ms), supplied
   * by the list so React.memo can tell a changed row from a bystander re-render.
   * A VALUE, never read off `asset`: WatermelonDB reuses one mutable instance per
   * id, so a comparator reading `asset` fields would compare it with itself.
   */
  fingerprint?: number;
};

// Asset row with the mockup's .asset-card anatomy — the same shape as
// WorkOrderCard so the two lists read as one system. Every field is already on
// the record, so unlike the WO row this needs no relation observation.
function AssetListItemBase({ asset, onPress, unavailableNote }: Props) {
  const unavailable = !!unavailableNote;

  return (
    <Pressable onPress={onPress} disabled={onPress === undefined || unavailable}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingTop: 14,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: 13,
            backgroundColor: pressed && !unavailable ? theme.colors.bg : theme.colors.white,
            borderWidth: 1,
            borderColor: theme.colors.line,
            borderRadius: theme.radii.xl,
            opacity: unavailable ? 0.55 : 1,
          }}
        >
          <AssetStatusTile color={asset.currentStatusColor} />

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
                {asset.equipmentName || 'Asset'}
              </Text>
              <AssetStatusPill color={asset.currentStatusColor} />
            </View>

            <Text style={[theme.text.code, { marginTop: 2 }]}>
              {asset.assetCode || asset.code || '—'}
            </Text>

            {unavailableNote ? (
              <Text style={[theme.text.micro, { marginTop: 4 }]}>{unavailableNote}</Text>
            ) : null}

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
                  {asset.location || '—'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {asset.assetType ? <Pill variant="type" label={asset.assetType} /> : null}
                <TierBadge tier={asset.tier} />
              </View>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

// Skip re-rendering an unchanged row on a bystander re-render. unavailableNote is
// compared because it flips independently of the asset's own fields (the tag
// picker derives it from a separate open-repair query); onPress is excluded, as
// it closes only over stable values. Absent fingerprint → never skip.
function areEqual(a: Props, b: Props): boolean {
  if (a.fingerprint === undefined || b.fingerprint === undefined) return false;
  return (
    a.asset.id === b.asset.id &&
    a.fingerprint === b.fingerprint &&
    a.unavailableNote === b.unavailableNote
  );
}

export const AssetListItem = memo(AssetListItemBase, areEqual);
