import { Text, View } from 'react-native';

import { theme } from '../theme';
import { Card } from './Card';

export type InfoRowSpec = {
  label: string;
  value: string;
  /** Secondary line under the value (the mockup's .sub). */
  sub?: string | null;
  /** Renders the value in the action red (the mockup's .value.urgent). */
  urgent?: boolean;
};

type Props = {
  label: string;
  rows: InfoRowSpec[];
};

// The mockup's .info-card: uppercase card label over label/value rows divided
// by hairlines, with no divider under the last row. Taking rows as data (not
// children) is what keeps that last-row rule correct without the caller
// having to know which row is last.
export function InfoCard({ label, rows }: Props) {
  return (
    <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 6, marginTop: 14 }}>
      <Text style={[theme.text.cardLabel, { paddingTop: 12, paddingBottom: 2 }]}>{label}</Text>

      {rows.map((row, index) => (
        <View
          key={row.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.lg,
            paddingVertical: 12,
            borderBottomWidth: index === rows.length - 1 ? 0 : 1,
            borderBottomColor: theme.colors.lineFaint,
          }}
        >
          <Text style={theme.text.caption}>{row.label}</Text>

          <View style={{ flexShrink: 1 }}>
            <Text
              style={{
                fontFamily: theme.fonts.bold,
                fontSize: 13.5,
                color: row.urgent ? theme.colors.red : theme.colors.ink,
                textAlign: 'right',
              }}
            >
              {row.value}
            </Text>
            {row.sub ? (
              <Text
                style={[
                  theme.text.micro,
                  { color: theme.colors.faint, textAlign: 'right', marginTop: 2 },
                ]}
              >
                {row.sub}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </Card>
  );
}
