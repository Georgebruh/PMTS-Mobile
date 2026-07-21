import { Text, View } from 'react-native';

import { assetStatusMeta } from '../asset/status';
import { theme } from '../theme';
import { Icon } from './Icon';

// Assets carry a status COLOUR, so unlike the work-order pill/tile (which map
// onto the three tag variants) these render theme.status directly — the real
// four-colour palette, black included.

export function AssetStatusPill({ color }: { color: string }) {
  const meta = assetStatusMeta(color);
  const { bg, text } = theme.status[meta.color];
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: theme.radii.pill,
        paddingVertical: 3,
        paddingHorizontal: 9,
        alignSelf: 'flex-start',
      }}
    >
      <Text numberOfLines={1} style={[theme.text.pill, { color: text }]}>
        {meta.label}
      </Text>
    </View>
  );
}

export function AssetStatusTile({ color }: { color: string }) {
  const meta = assetStatusMeta(color);
  const { bg, text } = theme.status[meta.color];
  return (
    <View
      style={{
        width: theme.sizes.statusTile,
        height: theme.sizes.statusTile,
        borderRadius: theme.radii.md,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={meta.icon} size={19} color={text} strokeWidth={2} />
    </View>
  );
}
