import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useSession } from '../auth/session';
import { theme } from '../theme';
import { Avatar } from './Avatar';
import { ProfileSheet } from './ProfileSheet';

/**
 * Header entry point to the account sheet. Self-mounting from session state
 * rather than prop-driven, so every tab screen gets the same affordance with
 * no threading through Screen's callers.
 *
 * Deliberately quiet: the header's other two items (sync, notifications) are
 * live operational status and must out-rank a "who am I" control, so this is a
 * flat tonal disc — no border, no shadow.
 */
export function ProfileButton() {
  const user = useSession((s) => s.user);
  const actAsL1 = useSession((s) => s.actAsL1);
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Profile — ${user.full_name || user.email}`}
        style={({ pressed }) => ({
          width: theme.sizes.iconButton,
          height: theme.sizes.iconButton,
          borderRadius: theme.sizes.iconButton / 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Avatar fullName={user.full_name} size={32} />
        {/* Only the *temporary* downgrade is worth a badge — a user's own
            standing role is not news to them. */}
        {actAsL1 && <ActingAsL1Dot />}
      </Pressable>

      <ProfileSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ActingAsL1Dot() {
  return (
    <View
      style={{
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 11,
        height: 11,
        borderRadius: 5.5,
        backgroundColor: theme.colors.notifDot,
        borderWidth: 2,
        borderColor: theme.colors.bg,
      }}
    />
  );
}
