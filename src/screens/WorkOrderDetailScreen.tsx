import { Q } from '@nozbe/watermelondb';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import { DetailScreen } from '../components/DetailScreen';
import { EmptyState } from '../components/EmptyState';
import { WorkOrderCard } from '../components/WorkOrderCard';
import { database } from '../database/database';
import { useObservable } from '../hooks/useObservable';
import type { HomeStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { asSubscribable, type WoRecord } from '../wo/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'WorkOrderDetail'>;

// Feature F stub — proves the list → woId param → detail pipeline end-to-end
// before the real screen exists: the card below is the live row for the id
// the list passed. Feature H replaces this screen's internals; the route and
// param shape stay.
export function WorkOrderDetailScreen({ navigation, route }: Props) {
  const { woId } = route.params;

  // query().observe() instead of findAndObserve — a WO deleted by a sync
  // while this screen is open must render the empty card, not throw.
  const rows = useObservable(
    () =>
      asSubscribable<WoRecord[]>(
        database.get('work_orders').query(Q.where('id', woId)).observe(),
      ),
    [woId],
  );
  const wo = rows?.[0] ?? null;

  return (
    <DetailScreen title="Work Order" onBack={() => navigation.goBack()}>
      {rows !== undefined &&
        (wo === null ? (
          <View style={{ marginTop: theme.spacing.md }}>
            <EmptyState
              title="Work order not found"
              caption="It may have been removed by a sync."
            />
          </View>
        ) : (
          <View style={{ marginTop: theme.spacing.md, gap: 10 }}>
            <WorkOrderCard wo={wo} />
            <Text style={theme.text.caption}>
              The full Work Order Detail (crew, Start/Complete) arrives with Feature H.
            </Text>
          </View>
        ))}
    </DetailScreen>
  );
}
