import { Text, View } from 'react-native';

import { theme } from '../theme';
import { Icon } from './Icon';

/**
 * Initials beat a generic glyph on a shared field device: the avatar's job is
 * answering *whose session is this*, and a hard hat only answers "a worker's".
 * The worker glyph stays as the fallback for accounts with no usable name.
 */
export function initialsOf(fullName: string): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w));
  if (words.length === 0) return '';
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : '';
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

type Props = {
  fullName: string;
  /** Outer diameter. Text scales with it; the glyph fallback sits at ~55%. */
  size: number;
};

export function Avatar({ fullName, size }: Props) {
  const initials = initialsOf(fullName);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {initials ? (
        <Text
          style={{
            fontFamily: theme.fonts.bold,
            fontSize: size * 0.36,
            color: theme.colors.maroon,
            letterSpacing: 0.3,
          }}
        >
          {initials}
        </Text>
      ) : (
        <Icon name="worker" size={size * 0.55} color={theme.colors.maroon} />
      )}
    </View>
  );
}
