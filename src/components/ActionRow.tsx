import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { theme } from '../theme';
import { Icon } from './Icon';
import type { IconName } from './icons';

// The mockup's .action-bar is absolutely pinned to the bottom, but in this app
// Feature D's nav pill + FAB already float there on every pushed screen. So the
// actions render INLINE in the detail body instead of overlapping that chrome.

export function ActionRow({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'ghost';
  onPress: () => void;
  disabled?: boolean;
};

// The mockup's .btn in its primary and ghost variants.
export function ActionButton({
  label,
  icon,
  variant = 'ghost',
  onPress,
  disabled = false,
}: ButtonProps) {
  const primary = variant === 'primary';
  const contentColor = primary ? theme.colors.white : theme.colors.red;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        height: theme.sizes.button,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        borderRadius: theme.radii.lg,
        backgroundColor: primary
          ? pressed
            ? theme.colors.redPressed
            : theme.colors.red
          : pressed
            ? theme.colors.redSoft
            : theme.colors.white,
        borderWidth: primary ? 0 : 1.5,
        borderColor: theme.colors.red,
        opacity: disabled ? 0.45 : 1,
      })}
    >
      {icon !== undefined && <Icon name={icon} size={17} color={contentColor} strokeWidth={2} />}
      <Text style={{ fontFamily: theme.fonts.bold, fontSize: 14, color: contentColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
