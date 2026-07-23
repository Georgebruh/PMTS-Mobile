import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssetList, useLockedAssets } from '../../asset/hooks';
import type { AreaLock } from '../../asset/lock';
import { ASSETS_PER_PAGE, distinctValues, type AssetFilter } from '../../asset/queries';
import { AssetFilterModal } from '../../components/AssetFilterModal';
import { AssetListItem } from '../../components/AssetListItem';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Pagination } from '../../components/Pagination';
import { Screen } from '../../components/Screen';
import { SearchField } from '../../components/SearchField';
import { theme } from '../../theme';

type Props = {
  lock: AreaLock;
  onOpenAsset: (assetId: string) => void;
};

// L2's asset list: AREA-locked only (never location-locked), with search,
// type/status/location filters, and the mockup's 10-per-page pagination.
export function AssetListL2({ lock, onOpenAsset }: Props) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<AssetFilter>({});
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  const filter = useMemo<AssetFilter>(() => ({ ...filters, search }), [filters, search]);
  const rows = useAssetList(2, lock, filter);
  // Unfiltered locked set — the filter sheet offers only reachable values.
  const locked = useLockedAssets(2, lock);

  // Any change to the result set starts over at page 1, so a narrowed filter
  // can never leave the user stranded on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [filter.type, filter.status, filter.location, filter.search]);

  const total = rows?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ASSETS_PER_PAGE));
  // Clamped rather than stored: rows can shrink under us when a sync lands.
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows
    ? rows.slice((currentPage - 1) * ASSETS_PER_PAGE, currentPage * ASSETS_PER_PAGE)
    : [];

  const types = useMemo(
    () => (locked ? distinctValues(locked, (a) => a.assetType) : []),
    [locked],
  );
  const statuses = useMemo(
    () => (locked ? distinctValues(locked, (a) => a.currentStatusColor) : []),
    [locked],
  );
  const locations = useMemo(
    () => (locked ? distinctValues(locked, (a) => a.location) : []),
    [locked],
  );

  const filterActive =
    filters.type !== undefined ||
    filters.status !== undefined ||
    filters.location !== undefined;

  return (
    <Screen title="Assets" scroll={false}>
      <View style={{ paddingHorizontal: theme.spacing.xl }}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          onPressFilter={() => setFilterOpen(true)}
          filterActive={filterActive}
        />
      </View>

      {rows === undefined && (
        <View style={{ paddingHorizontal: theme.spacing.xl, marginTop: theme.spacing.md }}>
          <LoadingState />
        </View>
      )}

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
          {total} asset{total === 1 ? '' : 's'} · {ASSETS_PER_PAGE} per page
        </Text>
      )}

      {rows !== undefined && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: 128 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {total === 0 ? (
            <EmptyState
              title="No assets"
              caption={
                filterActive || search.trim().length > 0
                  ? 'Nothing matches these filters.'
                  : 'No assets in your area yet.'
              }
            />
          ) : (
            <>
              <View style={{ gap: 10 }}>
                {pageRows.map((asset) => (
                  <AssetListItem
                    key={asset.id}
                    asset={asset}
                    fingerprint={asset.updatedAt?.getTime() ?? 0}
                    onPress={() => onOpenAsset(asset.id)}
                  />
                ))}
              </View>

              {pageCount > 1 && (
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPrev={() => setPage(Math.max(1, currentPage - 1))}
                  onNext={() => setPage(Math.min(pageCount, currentPage + 1))}
                />
              )}
            </>
          )}
        </ScrollView>
      )}

      <AssetFilterModal
        visible={filterOpen}
        filter={filter}
        types={types}
        statuses={statuses}
        locations={locations}
        onApply={(next) => {
          setFilters({ type: next.type, status: next.status, location: next.location });
          setFilterOpen(false);
        }}
        onClose={() => setFilterOpen(false)}
      />
    </Screen>
  );
}
