import { Text, View } from 'react-native';

import { theme, type TagVariant } from '../theme';

type Props = {
  variant: TagVariant;
  label: string;
};

export function Pill({ variant, label }: Props) {
  const { bg, text } = theme.tags[variant];
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: theme.radii.pill,
        paddingVertical: 3,
        paddingHorizontal: 9,
        alignSelf: 'flex-start',
      }}
    >
      <Text numberOfLines={1} style={[theme.text.pill, { color: text }]}>
        {label}
      </Text>
    </View>
  );
}
