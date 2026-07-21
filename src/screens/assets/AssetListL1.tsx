import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssetList } from '../../asset/hooks';
import type { AreaLock } from '../../asset/lock';
import type { AssetRecord } from '../../asset/types';
import { AssetListItem } from '../../components/AssetListItem';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { SearchField } from '../../components/SearchField';
import { theme } from '../../theme';

type Props = {
  lock: AreaLock;
  onOpenAsset: (assetId: string) => void;
};

// L1's asset list: HARD-locked to the staff's area AND locations, with search
// but no filters and no pagination — there is deliberately no control here
// that can widen the scope. The whole locked set is virtualized.
export function AssetListL1({ lock, onOpenAsset }: Props) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const filter = useMemo(() => ({ search }), [search]);
  const rows = useAssetList(1, lock, filter);

  const renderItem = ({ item }: { item: AssetRecord }) => (
    <AssetListItem asset={item} onPress={() => onOpenAsset(item.id)} />
  );

  return (
    <Screen title="Assets" scroll={false}>
      <View style={{ paddingHorizontal: theme.spacing.xl }}>
        <SearchField value={search} onChangeText={setSearch} />
      </View>

      {/* Nothing renders below the search until the first emission — a stale
          or fake-empty list never flashes under a new lock. */}
      {rows !== undefined && (
        <Text
          style={[
            theme.text.micro,
            {
              marginTop: theme.spacing.md,
              marginBottom: 10,
              marginHorizontal: theme.spacing.xl + 2,
            },
          ]}
        >
          {rows.length} asset{rows.length === 1 ? '' : 's'} · your area and locations
        </Text>
      )}

      {rows !== undefined &&
        (rows.length === 0 ? (
          <View style={{ paddingHorizontal: theme.spacing.xl }}>
            <EmptyState
              title="No assets"
              caption={
                search.trim().length > 0
                  ? 'Nothing matches that search.'
                  : 'No assets are assigned to your area and locations yet.'
              }
            />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlashList
              data={rows}
              keyExtractor={(asset) => asset.id}
              renderItem={renderItem}
              ItemSeparatorComponent={RowGap}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.xl,
                // Clears the floating nav pill + FAB, like every scroll body.
                paddingBottom: 128 + insets.bottom,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        ))}
    </Screen>
  );
}

function RowGap() {
  return <View style={{ height: 10 }} />;
}
