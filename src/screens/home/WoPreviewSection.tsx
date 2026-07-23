import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { View } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { SectionHead } from '../../components/SectionHead';
import { SeeAllRow } from '../../components/SeeAllRow';
import { WorkOrderCard } from '../../components/WorkOrderCard';
import type { HomeStackParamList } from '../../navigation/types';
import { useWoPreview } from '../../wo/hooks';
import type { WoListFilter } from '../../wo/queries';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

// The five most urgent open WOs (tier 1→2→3, then due date) under the cards.
// L1 passes assignedTo to keep it personal; L2 sees the whole mirror.
export function WoPreviewSection({ assignedTo }: { assignedTo?: string }) {
  const navigation = useNavigation<Nav>();
  const preview = useWoPreview(assignedTo);
  const openFilter = useMemo<WoListFilter>(() => ({ kind: 'open', assignedTo }), [assignedTo]);

  if (preview === undefined) return null; // still subscribing — no header flash

  return (
    <>
      <SectionHead title="Work Orders" />
      {preview.length === 0 ? (
        <EmptyState
          title="No open work orders"
          caption="New and synced-in work orders appear here."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {preview.map((wo) => (
            <WorkOrderCard key={wo.id} wo={wo} />
          ))}
        </View>
      )}
      <SeeAllRow onPress={() => navigation.navigate('WorkOrderList', { filter: openFilter })} />
    </>
  );
}
