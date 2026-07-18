import { Text } from 'react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { SectionHead } from '../components/SectionHead';
import { theme } from '../theme';

// Feature D placeholder (L2-only tab) — Feature K builds the real range
// presets and date navigator.
export function CalendarScreen() {
  return (
    <Screen title="Calendar">
      <SectionHead title="Schedule" />
      <Card style={{ padding: theme.spacing.lg, gap: 4 }}>
        <Text style={theme.text.cardTitle}>Your team's schedule lands here</Text>
        <Text style={theme.text.caption}>
          Range presets and the date navigator arrive with Feature K.
        </Text>
      </Card>
    </Screen>
  );
}
