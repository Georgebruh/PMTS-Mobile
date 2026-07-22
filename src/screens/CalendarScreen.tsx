import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarPicker } from '../components/CalendarPicker';
import { EmptyState } from '../components/EmptyState';
import { DatePill } from '../components/DatePill';
import { FilterChips, type ChipItem } from '../components/FilterChips';
import { Screen } from '../components/Screen';
import { SectionHead } from '../components/SectionHead';
import { WorkOrderCard } from '../components/WorkOrderCard';
import type { CalendarStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useTodayBounds, useWoRange } from '../wo/hooks';
import {
  CALENDAR_PRESETS,
  PRESET_LABELS,
  formatRangeLabel,
  isNavigable,
  rangeForPreset,
  shiftDay,
  type CalendarPreset,
  type CustomSpan,
} from '../wo/ranges';
import type { WoRecord } from '../wo/types';

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarMain'>;

const PRESET_CHIPS: ChipItem<CalendarPreset>[] = CALENDAR_PRESETS.map((p) => ({
  key: p,
  label: PRESET_LABELS[p],
}));

// Feature K — the L2 Calendar. A preset row + date pill choose a [start, end)
// window; useWoRange returns the work orders due inside it, tier-sorted in the
// same frozen order as the Work Order List, and a card tap opens WO Detail in
// this tab. L2-only: the tab never mounts for L1, and an L2 acting as L1
// unmounts it, so no client-side lock is needed beyond the server-scoped mirror
// (unlike the Asset screens, which an L2-as-L1 can widen).
export function CalendarScreen({ navigation }: Props) {
  const bounds = useTodayBounds();
  const insets = useSafeAreaInsets();

  // "Today", recomputed at the midnight foreground rollover (useTodayBounds).
  // The period presets are relative to it; the 1-day view uses its own anchor.
  const now = useMemo(() => new Date(bounds.start), [bounds.start]);

  const [preset, setPreset] = useState<CalendarPreset>('day');
  const [dayAnchor, setDayAnchor] = useState<Date>(() => new Date());
  const [customSpan, setCustomSpan] = useState<CustomSpan | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

  const range = useMemo(
    () => rangeForPreset(preset, dayAnchor, now, customSpan),
    [preset, dayAnchor, now, customSpan],
  );
  const rows = useWoRange(range);
  const label = formatRangeLabel(preset, range);

  const selectPreset = (next: CalendarPreset) => {
    if (next === 'custom') {
      // Show Custom (falling back to today until a span is applied) and open
      // the picker to choose one.
      setPreset('custom');
      setPickerOpen(true);
      return;
    }
    // Re-center the 1-day view on today whenever it is (re)selected, so "1 Day"
    // always means today; ◀ ▶ then browses from there.
    if (next === 'day') setDayAnchor(new Date(now));
    setPreset(next);
  };

  const renderItem = ({ item }: { item: WoRecord }) => (
    <WorkOrderCard
      wo={item}
      onPress={() => navigation.navigate('WorkOrderDetail', { woId: item.id })}
    />
  );

  return (
    <Screen title="Calendar" scroll={false}>
      <View style={{ paddingHorizontal: theme.spacing.xl, marginTop: theme.spacing.md }}>
        <DatePill
          label={label}
          navigable={isNavigable(preset)}
          onPrev={() => setDayAnchor((a) => shiftDay(a, -1))}
          onNext={() => setDayAnchor((a) => shiftDay(a, 1))}
          onPress={preset === 'custom' ? () => setPickerOpen(true) : undefined}
        />
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <FilterChips chips={PRESET_CHIPS} activeKey={preset} onSelect={selectPreset} />
      </View>

      {/* Nothing below the chips renders until the first emission — a stale or
          fake-empty list never flashes under a new range. */}
      {rows !== undefined && (
        <View style={{ paddingHorizontal: theme.spacing.xl }}>
          <SectionHead title="Scheduled" count={rows.length} />
        </View>
      )}

      {rows !== undefined &&
        (rows.length === 0 ? (
          <View style={{ paddingHorizontal: theme.spacing.xl }}>
            <EmptyState
              title="Nothing scheduled"
              caption="No work orders are due in this range."
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

      <CalendarPicker
        visible={pickerOpen}
        initialStart={customSpan?.start}
        initialEnd={customSpan?.end}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(start, end) => {
          setCustomSpan({ start, end });
          setPreset('custom');
          setPickerOpen(false);
        }}
      />
    </Screen>
  );
}

function RowGap() {
  return <View style={{ height: 10 }} />;
}
