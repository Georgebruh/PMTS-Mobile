import { Text, View } from 'react-native';

import { formatDate } from '../asset/format';
import { eventLabel } from '../asset/queries';
import { assetStatusMeta } from '../asset/status';
import type { AssetHistoryRecord } from '../asset/types';
import { theme } from '../theme';
import { Card } from './Card';

type Props = {
  events: AssetHistoryRecord[];
};

// The Asset History timeline — net-new (the mockup has no history design), so
// it borrows the .info-card surface and adds a dot-and-rail left gutter. Rows
// arrive newest-first from useAssetHistory.
export function HistoryTimeline({ events }: Props) {
  return (
    <Card style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 6, marginTop: 14 }}>
      <Text style={[theme.text.cardLabel, { paddingTop: 12, paddingBottom: 2 }]}>History</Text>

      {events.map((event, index) => {
        const last = index === events.length - 1;
        // Undated/uncoloured events still render — sheet rows can be sparse.
        const dotColor = event.statusColor
          ? theme.status[assetStatusMeta(event.statusColor).color].text
          : theme.colors.faint;
        const meta = [formatDate(event.eventAt), event.actor].filter(Boolean).join(' · ');

        return (
          <View
            key={event.id}
            style={{ flexDirection: 'row', gap: theme.spacing.md, paddingTop: 12 }}
          >
            <View style={{ alignItems: 'center', width: 9 }}>
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 4.5,
                  backgroundColor: dotColor,
                  marginTop: 4,
                }}
              />
              {!last && (
                <View
                  style={{
                    flex: 1,
                    width: 1.5,
                    backgroundColor: theme.colors.line,
                    marginTop: 4,
                  }}
                />
              )}
            </View>

            <View style={{ flex: 1, paddingBottom: last ? 14 : 0 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.bold,
                  fontSize: 13.5,
                  color: theme.colors.ink,
                }}
              >
                {eventLabel(event.eventType)}
              </Text>
              {meta.length > 0 && (
                <Text style={[theme.text.micro, { marginTop: 2 }]}>{meta}</Text>
              )}
              {event.notes ? (
                <Text style={[theme.text.caption, { marginTop: 4 }]}>{event.notes}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}
