import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { WEEK_START_DOW } from '../wo/ranges';
import { Icon } from './Icon';

type Props = {
  visible: boolean;
  initialStart?: Date | null;
  initialEnd?: Date | null;
  onCancel: () => void;
  /** Two inclusive day anchors; the caller normalizes order via customRange. */
  onConfirm: (start: Date, end: Date) => void;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// A pure-JS calendar range picker (no native date module — the dev client is
// unchanged). Two taps pick an inclusive [start, end] span; a single tap is a
// one-day span. Monday-first, driven by the same WEEK_START_DOW the range math
// uses, so the grid and the "This Week" preset can never disagree. Rendered in
// an RN Modal, which portals above the tab navigator's absolute-fill nav pill +
// FAB — the same reason Feature I's report modal is a root route.
export function CalendarPicker({ visible, initialStart, initialEnd, onCancel, onConfirm }: Props) {
  const [start, setStart] = useState<Date | null>(initialStart ? dayStart(initialStart) : null);
  const [end, setEnd] = useState<Date | null>(initialEnd ? dayStart(initialEnd) : null);
  const [view, setView] = useState<Date>(() =>
    initialStart ? new Date(initialStart.getFullYear(), initialStart.getMonth(), 1) : firstOfThisMonth(),
  );

  // lo/hi are the ordered endpoints for highlighting; a lone start reads as a
  // single day until the second tap lands.
  const [lo, hi] = useMemo<[Date | null, Date | null]>(() => {
    if (!start) return [null, null];
    const other = end ?? start;
    return start.getTime() <= other.getTime() ? [start, other] : [other, start];
  }, [start, end]);

  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => DOW_SHORT[(WEEK_START_DOW + i) % 7]),
    [],
  );

  const cells = useMemo<(number | null)[]>(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const lead = (new Date(y, m, 1).getDay() - WEEK_START_DOW + 7) % 7;
    const out: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth(y, m); d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const tapDay = (dn: number) => {
    const picked = new Date(view.getFullYear(), view.getMonth(), dn);
    // First tap, or a fresh start after a completed range.
    if (!start || (start && end)) {
      setStart(picked);
      setEnd(null);
    } else {
      setEnd(picked);
    }
  };

  const shiftMonth = (delta: number) => {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  };

  const apply = () => {
    if (!start) return;
    onConfirm(start, end ?? start);
  };

  const now = dayStart(new Date()).getTime();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Stop the inner card from dismissing the modal when tapped. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.monthRow}>
            <NavButton icon="chevleft" onPress={() => shiftMonth(-1)} />
            <Text style={styles.monthLabel}>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </Text>
            <NavButton icon="chevright" onPress={() => shiftMonth(1)} />
          </View>

          <View style={styles.weekRow}>
            {weekdays.map((w) => (
              <Text key={w} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((dn, i) => {
              if (dn === null) return <View key={`b${i}`} style={styles.cell} />;
              const t = new Date(view.getFullYear(), view.getMonth(), dn).getTime();
              const isStart = lo !== null && t === lo.getTime();
              const isEnd = hi !== null && t === hi.getTime();
              const endpoint = isStart || isEnd;
              const inRange = lo !== null && hi !== null && t > lo.getTime() && t < hi.getTime();
              const isToday = t === now;
              return (
                <Pressable key={`d${dn}`} style={styles.cell} onPress={() => tapDay(dn)}>
                  <View
                    style={[
                      styles.dayCircle,
                      inRange && { backgroundColor: theme.colors.redSoft },
                      endpoint && { backgroundColor: theme.colors.red },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        inRange && { color: theme.colors.maroon },
                        endpoint && { color: theme.colors.white, fontFamily: theme.fonts.bold },
                      ]}
                    >
                      {dn}
                    </Text>
                    {isToday && !endpoint && <View style={styles.todayDot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.btn, styles.btnGhost, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={apply}
              disabled={!start}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                { opacity: !start ? 0.4 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.btnPrimaryText}>Apply</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function firstOfThisMonth(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}

function NavButton({ icon, onPress }: { icon: 'chevleft' | 'chevright'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={16} color={theme.colors.maroon} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(34,31,31,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.sheet,
    padding: theme.spacing.lg,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  monthLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.ink,
  },
  navBtn: {
    width: theme.sizes.iconButton,
    height: theme.sizes.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.sizes.iconButton / 2,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.fonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: theme.colors.faint,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontFamily: theme.fonts.regular,
    fontSize: 13.5,
    color: theme.colors.ink,
  },
  todayDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.red,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.white,
  },
  btnGhostText: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: theme.colors.muted,
  },
  btnPrimary: {
    backgroundColor: theme.colors.red,
  },
  btnPrimaryText: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: theme.colors.white,
  },
});
