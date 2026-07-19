import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRole, useSession } from '../auth/session';
import { DetailScreen } from '../components/DetailScreen';
import { EmptyState } from '../components/EmptyState';
import { FilterChips, type ChipItem } from '../components/FilterChips';
import { WorkOrderCard } from '../components/WorkOrderCard';
import type { HomeStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { chipsForRole } from '../wo/chips';
import { useTodayBounds, useWoList } from '../wo/hooks';
import { FILTER_TITLES, type WoListFilterKind } from '../wo/queries';
import type { WoRecord } from '../wo/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'WorkOrderList'>;

// Feature F — the real Work Order List. One shared screen for both roles,
// parameterized by the filter the dashboard card (or See-all, or a chip)
// supplied. Route params are the single source of truth: chips call
// setParams, so no stack growth and back always returns to Home in one step.
// Rows arrive pre-sorted in the frozen order from useWoList.
export function WorkOrderListScreen({ navigation, route }: Props) {
  const { filter } = route.params;
  const bounds = useTodayBounds();
  const insets = useSafeAreaInsets();
  const role = useRole();
  const userId = useSession((s) => s.user?.id ?? '');

  const rows = useWoList(filter, bounds);

  // Effective-role chips: an Act-as-L1 flip mid-screen swaps the chip set
  // live. The arriving filter is kept even if its chip vanished (activeKey
  // just goes null) — visibility is server-scoped, so nothing leaks.
  const chips = useMemo(
    () => (role === null ? [] : chipsForRole(role, userId)),
    [role, userId],
  );
  const chipItems = useMemo<ChipItem<WoListFilterKind>[]>(
    () => chips.map((c) => ({ key: c.kind, label: c.label })),
    [chips],
  );
  const activeKey = chips.some((c) => c.kind === filter.kind) ? filter.kind : null;

  const selectChip = (kind: WoListFilterKind) => {
    const chip = chips.find((c) => c.kind === kind);
    if (chip) navigation.setParams({ filter: chip.filter });
  };

  const renderItem = ({ item }: { item: WoRecord }) => (
    <WorkOrderCard
      wo={item}
      onPress={() => navigation.navigate('WorkOrderDetail', { woId: item.id })}
    />
  );

  return (
    <DetailScreen
      title={FILTER_TITLES[filter.kind]}
      onBack={() => navigation.goBack()}
      scroll={false}
    >
      <View style={{ marginTop: theme.spacing.md }}>
        <FilterChips chips={chipItems} activeKey={activeKey} onSelect={selectChip} />
      </View>

      {/* Nothing renders below the chips until the first emission — a stale
          or fake-empty list never flashes under a new title. */}
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
          {rows.length} work order{rows.length === 1 ? '' : 's'} · tier-sorted
        </Text>
      )}

      {rows !== undefined &&
        (rows.length === 0 ? (
          <View style={{ paddingHorizontal: theme.spacing.xl }}>
            <EmptyState
              title="No work orders"
              caption="Nothing matches this filter right now."
            />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlashList
              data={rows}
              keyExtractor={(wo) => wo.id}
              renderItem={renderItem}
              ItemSeparatorComponent={RowGap}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.xl,
                // Clears the floating nav pill + FAB, like every scroll body.
                paddingBottom: 128 + insets.bottom,
              }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ))}
    </DetailScreen>
  );
}

function RowGap() {
  return <View style={{ height: 10 }} />;
}
