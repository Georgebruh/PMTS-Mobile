import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, Text } from 'react-native';

import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { SectionHead } from '../components/SectionHead';
import type { HomeStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useDraftReportCount, useTodayBounds, useWoCount } from '../wo/hooks';
import { FILTER_TITLES } from '../wo/queries';

type Props = NativeStackScreenProps<HomeStackParamList, 'WorkOrderList'>;

// Feature E stub — proves the card → filter param → query pipeline end-to-end
// before the real list exists: the count shown here uses the same builders as
// the tapped card, so the two must agree. Feature F replaces this screen's
// internals; the route, FILTER_TITLES, and woClauses stay as its data source.
export function WorkOrderListScreen({ navigation, route }: Props) {
  const { filter } = route.params;
  const bounds = useTodayBounds();

  // Hooks stay unconditional; only one of the two counts is displayed. The
  // myDrafts card counts draft REPORTS, so the stub mirrors that count.
  const woCount = useWoCount(filter, bounds);
  const draftCount = useDraftReportCount(filter.reporterId ?? '');
  const count = filter.kind === 'myDrafts' ? draftCount : woCount;

  const noun = filter.kind === 'myDrafts' ? 'draft report' : 'work order';

  return (
    <Screen title={FILTER_TITLES[filter.kind]}>
      {/* The Screen scaffold has no back affordance — Feature F builds the
          real one. Hardware back works regardless. */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          marginTop: theme.spacing.md,
          paddingVertical: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon
          name="chevleft"
          size={theme.sizes.iconSmall}
          color={theme.colors.maroon}
          strokeWidth={2.2}
        />
        <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.maroon }}>
          Back
        </Text>
      </Pressable>

      <SectionHead title="Filtered result" count={count} />
      <Card style={{ padding: theme.spacing.lg, gap: 4 }}>
        <Text style={theme.text.cardTitle}>
          {count === undefined
            ? 'Counting…'
            : `${count} matching ${noun}${count === 1 ? '' : 's'}`}
        </Text>
        <Text style={theme.text.caption}>
          filter: {filter.kind}
          {filter.assignedTo !== undefined ? ` · assignedTo=${filter.assignedTo}` : ''}
          {filter.reporterId !== undefined ? ` · reporterId=${filter.reporterId}` : ''}
        </Text>
        <Text style={theme.text.caption}>
          The tier-sorted work order list arrives with Feature F.
        </Text>
      </Card>
    </Screen>
  );
}
