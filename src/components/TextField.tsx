import { TextInput, View } from 'react-native';

import { theme } from '../theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Fired by the keyboard's submit key — the crew field adds on submit. */
  onSubmitEditing?: () => void;
  maxLength?: number;
  editable?: boolean;
  /** Draws the field in the action red while an error is showing. */
  invalid?: boolean;
  /**
   * Feature I: Action Taken is a narrative field where a tech may write steps
   * on separate lines, so the box grows and the return key inserts a newline
   * instead of dismissing.
   */
  multiline?: boolean;
  /**
   * Defaults to 'words' — the crew field this component was built for takes
   * names. Parameter names and values need 'sentences'/'none', because
   * auto-capitalising a unit or a reading is wrong.
   */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

// A plain single-line text field matching the mockup's .search-field surface
// (same height, radius and border), minus the leading icon. Net-new for
// Feature H's crew input — the login screen's fields predate the token set and
// are not reusable here.
export function TextField({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  maxLength,
  editable = true,
  invalid = false,
  multiline = false,
  autoCapitalize = 'words',
}: Props) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: multiline ? 'flex-start' : 'center',
        backgroundColor: editable ? theme.colors.white : theme.colors.bg,
        borderWidth: 1,
        borderColor: invalid ? theme.colors.red : theme.colors.line,
        borderRadius: theme.radii.md,
        paddingHorizontal: 14,
        paddingVertical: multiline ? 12 : 0,
        height: multiline ? undefined : theme.sizes.searchField,
        minHeight: multiline ? theme.sizes.searchField * 2.5 : undefined,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.faint}
        onSubmitEditing={onSubmitEditing}
        maxLength={maxLength}
        editable={editable}
        autoCorrect={false}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        // A multiline field must let return insert a newline, and must grow
        // from the top rather than centring its first line on Android.
        returnKeyType={multiline ? undefined : 'done'}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          padding: 0,
          flex: multiline ? 1 : undefined,
          fontFamily: theme.fonts.regular,
          fontSize: 13.5,
          color: theme.colors.ink,
        }}
      />
    </View>
  );
}
