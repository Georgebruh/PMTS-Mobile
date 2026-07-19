import { Text } from 'react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { SectionHead } from '../components/SectionHead';
import { theme } from '../theme';

// Feature D placeholder (L2-only tab) — Feature L builds assignment and the
// approval queue.
export function StaffScreen() {
  return (
    <Screen title="Staff">
      <SectionHead title="Team" />
      <Card style={{ padding: theme.spacing.lg, gap: 4 }}>
        <Text style={theme.text.cardTitle}>Assignment and approvals land here</Text>
        <Text style={theme.text.caption}>
          Assigning work orders and the report approval queue arrive with Feature L.
        </Text>
      </Card>
    </Screen>
  );
}
