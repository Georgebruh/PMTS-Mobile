import { Pressable, TextInput, View } from 'react-native';

import { theme } from '../theme';
import { Icon } from './Icon';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Omit to hide the filter button entirely (L1 has search but no filters). */
  onPressFilter?: () => void;
  /** Highlights the filter button while any filter is applied. */
  filterActive?: boolean;
};

// The mockup's .search-row: search field + optional filter button, both 44px.
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search name, code, or location',
  onPressFilter,
  filterActive = false,
}: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          backgroundColor: theme.colors.white,
          borderWidth: 1,
          borderColor: theme.colors.line,
          borderRadius: theme.radii.md,
          paddingHorizontal: 14,
          height: theme.sizes.searchField,
        }}
      >
        <Icon name="search" size={theme.sizes.iconSmall} color={theme.colors.faint} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.faint}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          // clearButtonMode is iOS-only; Android users clear with the keyboard.
          clearButtonMode="while-editing"
          style={{
            flex: 1,
            padding: 0,
            fontFamily: theme.fonts.regular,
            fontSize: 13.5,
            color: theme.colors.ink,
          }}
        />
      </View>

      {onPressFilter !== undefined && (
        <Pressable
          onPress={onPressFilter}
          style={({ pressed }) => ({
            width: theme.sizes.searchField,
            height: theme.sizes.searchField,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: filterActive ? theme.colors.maroonDeep : theme.colors.white,
            borderWidth: 1,
            borderColor: filterActive ? theme.colors.maroonDeep : theme.colors.line,
            borderRadius: theme.radii.md,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon
            name="sliders"
            size={theme.sizes.iconSmall}
            color={filterActive ? theme.colors.white : theme.colors.ink}
          />
        </Pressable>
      )}
    </View>
  );
}
