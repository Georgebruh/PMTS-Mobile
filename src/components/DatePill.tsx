import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { Icon } from './Icon';

type Props = {
  /** The resolved range's label, e.g. "July 15" / "Jul 13 – 19" / "July 2026". */
  label: string;
  /** 1-day view: flank the label with ◀ ▶ that step the anchor a day. */
  navigable?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  /** Custom preset: tap the whole pill to (re)open the range picker. */
  onPress?: () => void;
};

// The mockup's .date-pill — a red rounded pill with white text. Three modes,
// one look: the 1-day view flanks the label with chevron steppers; the Custom
// preset makes the whole pill a button (a calendar glyph hints "pick dates");
// the week/month presets show a static label (they are relative to today, so
// there is nothing to step — the spec puts the navigator on the 1-day view).
export function DatePill({ label, navigable, onPrev, onNext, onPress }: Props) {
  const body = (
    <>
      {navigable && <StepButton icon="chevleft" onPress={onPrev} />}
      {!navigable && onPress && (
        <Icon name="calendar" size={15} color={theme.colors.white} strokeWidth={2.2} />
      )}
      <Text style={styles.dateText}>{label}</Text>
      {navigable && <StepButton icon="chevright" onPress={onNext} />}
    </>
  );

  if (onPress && !navigable) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pill, { opacity: pressed ? 0.85 : 1 }]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.pill}>{body}</View>;
}

function StepButton({
  icon,
  onPress,
}: {
  icon: 'chevleft' | 'chevright';
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.stepBtn,
        { backgroundColor: pressed ? 'rgba(255,255,255,0.18)' : 'transparent' },
      ]}
    >
      <Icon name={icon} size={15} color={theme.colors.white} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: theme.colors.red,
    borderRadius: theme.radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  stepBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  dateText: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.white,
    paddingHorizontal: 8,
    letterSpacing: 0.26,
  },
});
