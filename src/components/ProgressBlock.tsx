import { Text, View } from 'react-native';

import { theme } from '../theme';

type Props = {
  done: number;
  total: number;
};

// The mockup's Today's Progress block (.progress-block). Solid red fill — the
// CSS gradient (#E5231B → #B4181A) would need expo-linear-gradient, a native
// module and dev-client rebuild; skipped on purpose.
export function ProgressBlock({ done, total }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <View style={{ marginTop: theme.spacing.xl, marginBottom: 4 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.maroon }}>
          Today's Progress
        </Text>
        <Text style={{ fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.maroon }}>
          {pct}%
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.barTrack,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.red,
          }}
        />
      </View>
      <Text style={[theme.text.micro, { marginTop: 7 }]}>
        {done} of {total} due today done
      </Text>
    </View>
  );
}
