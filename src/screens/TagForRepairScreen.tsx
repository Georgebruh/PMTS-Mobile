import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAreaLock, useAssetList } from '../asset/hooks';
import type { LockRole } from '../asset/lock';
import type { AssetRecord } from '../asset/types';
import { useRole } from '../auth/session';
import { AssetListItem } from '../components/AssetListItem';
import { DetailScreen } from '../components/DetailScreen';
import { EmptyState } from '../components/EmptyState';
import { SearchField } from '../components/SearchField';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useOpenRepairAssetIds } from '../wo/hooks';
import { useTagAsset } from '../wo/useTagAsset';

type Props = NativeStackScreenProps<RootStackParamList, 'TagForRepair'>;

/**
 * Feature J — the asset picker behind the FAB's Tag Asset for Repair.
 *
 * Presented from the ROOT stack, above the tab navigator, for the reason
 * Feature I's modal documents: BottomBar is an absoluteFill layer the tab
 * navigator draws over everything nested inside it, so a picker pushed into a
 * tab stack would wear the very FAB that opened it.
 *
 * It reuses useAssetList under the effective role's lock, which is what makes
 * the scope guarantee cheap: this list is the SAME query as the Assets tab, so
 * the picker physically cannot offer an asset the user may not see. The
 * mutation re-checks the lock anyway — a role can flip while this is open.
 *
 * Asset Detail does NOT come through here; it already has its asset and calls
 * useTagAsset directly.
 */
export function TagForRepairScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const role = useRole();
  const lockRole: LockRole = role === 1 ? 1 : 2;
  const lock = useAreaLock();

  const [search, setSearch] = useState('');
  const filter = useMemo(() => ({ search }), [search]);
  const rows = useAssetList(lockRole, lock, filter);
  const alreadyTagged = useOpenRepairAssetIds();

  const { tag, busy } = useTagAsset();

  const onPick = async (asset: AssetRecord) => {
    const done = await tag(asset);
    if (done) navigation.goBack();
  };

  const renderItem = ({ item }: { item: AssetRecord }) => {
    const blocked = alreadyTagged?.has(item.id) ?? false;
    return (
      <AssetListItem
        asset={item}
        unavailableNote={blocked ? 'Already has an open repair work order' : null}
        onPress={busy ? undefined : () => void onPick(item)}
      />
    );
  };

  // Both queries must have emitted before anything is drawn: showing the list
  // before `alreadyTagged` arrives would briefly offer rows that are about to
  // grey out, and a tap landing in that window is exactly the refusal this
  // screen exists to avoid.
  const ready = rows !== undefined && alreadyTagged !== undefined;

  return (
    <DetailScreen title="Tag for Repair" onBack={() => navigation.goBack()} scroll={false}>
      <View style={{ paddingHorizontal: theme.spacing.xl }}>
        <SearchField value={search} onChangeText={setSearch} />
      </View>

      {ready && (
        <Text
          style={[
            theme.text.micro,
            { marginTop: theme.spacing.md, marginBottom: 10, marginHorizontal: theme.spacing.xl + 2 },
          ]}
        >
          Choose the asset that needs repair
        </Text>
      )}

      {ready &&
        (rows.length === 0 ? (
          <View style={{ paddingHorizontal: theme.spacing.xl }}>
            <EmptyState
              title="No assets"
              caption={
                search.trim().length > 0
                  ? 'Nothing matches that search.'
                  : 'No assets are available in your assigned scope.'
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
                // No nav pill or FAB behind a root-level modal, so this clears
                // the system bar only — not the 128px every tab screen uses.
                paddingBottom: theme.spacing.xl + insets.bottom,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        ))}
    </DetailScreen>
  );
}

function RowGap() {
  return <View style={{ height: 10 }} />;
}
