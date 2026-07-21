import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { theme } from '../theme';

type Props = {
  /** The pill row above the title (type + status). */
  pills: ReactNode;
  title: string;
  code?: string | null;
};

// The mockup's .detail-hero: pill row, large title, monospace code chip.
export function DetailHero({ pills, title, code }: Props) {
  return (
    <View style={{ paddingTop: 18, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {pills}
      </View>

      <Text
        style={{
          fontFamily: theme.fonts.bold,
          fontSize: 22,
          lineHeight: 26,
          color: theme.colors.ink,
        }}
      >
        {title}
      </Text>

      {code ? (
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: 8,
            backgroundColor: theme.colors.white,
            borderWidth: 1,
            borderColor: theme.colors.line,
            borderRadius: theme.radii.sm,
            paddingVertical: 4,
            paddingHorizontal: 10,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 12,
              letterSpacing: 0.6,
              color: theme.colors.muted,
            }}
          >
            {code}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
