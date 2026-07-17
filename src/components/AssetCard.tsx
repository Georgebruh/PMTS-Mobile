import { Text, View } from 'react-native';

import { theme } from '../theme';
import { Card } from './Card';
import { Icon } from './Icon';
import { Pill } from './Pill';
import { StatusTile, type StatusVariant } from './StatusTile';

type Props = {
  name: string;
  code: string;
  location: string;
  typeLabel: string;
  status: StatusVariant;
  statusLabel: string;
  /** Hide the left status tile (the Assets list renders cards without it). */
  showTile?: boolean;
};

// The mockup's .asset-card — reused by the Work Order and Asset lists later.
export function AssetCard({
  name,
  code,
  location,
  typeLabel,
  status,
  statusLabel,
  showTile = true,
}: Props) {
  return (
    <Card
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingTop: 14,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: 13,
      }}
    >
      {showTile && <StatusTile variant={status} />}

      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Text style={[theme.text.cardTitle, { flexShrink: 1 }]}>{name}</Text>
          <Pill variant={status} label={statusLabel} />
        </View>

        <Text style={[theme.text.code, { marginTop: 2 }]}>{code}</Text>

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
              {location}
            </Text>
          </View>
          <Pill variant="type" label={typeLabel} />
        </View>
      </View>
    </Card>
  );
}
