import { Pressable, Text, View } from 'react-native';

import { theme } from '../theme';
import { Icon } from './Icon';

type Props = {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
};

// The mockup's .pagination: prev · "Page N of M" · next.
export function Pagination({ page, pageCount, onPrev, onNext }: Props) {
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
        marginTop: 18,
        marginBottom: 4,
      }}
    >
      <PageButton icon="chevleft" disabled={atStart} onPress={onPrev} />
      <Text
        style={{
          fontFamily: theme.fonts.bold,
          fontSize: 12,
          color: theme.colors.muted,
        }}
      >
        Page {page} of {pageCount}
      </Text>
      <PageButton icon="chevright" disabled={atEnd} onPress={onNext} />
    </View>
  );
}

function PageButton({
  icon,
  disabled,
  onPress,
}: {
  icon: 'chevleft' | 'chevright';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.white,
        borderWidth: 1,
        borderColor: theme.colors.line,
        borderRadius: 10,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={15} color={theme.colors.maroon} strokeWidth={2.2} />
    </Pressable>
  );
}
