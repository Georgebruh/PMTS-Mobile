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
}: Props) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        backgroundColor: editable ? theme.colors.white : theme.colors.bg,
        borderWidth: 1,
        borderColor: invalid ? theme.colors.red : theme.colors.line,
        borderRadius: theme.radii.md,
        paddingHorizontal: 14,
        height: theme.sizes.searchField,
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
        // Worker names — capitalize each word, the way a name is written.
        autoCapitalize="words"
        returnKeyType="done"
        style={{
          padding: 0,
          fontFamily: theme.fonts.regular,
          fontSize: 13.5,
          color: theme.colors.ink,
        }}
      />
    </View>
  );
}
