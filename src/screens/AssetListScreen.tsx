import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, Text } from 'react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { SectionHead } from '../components/SectionHead';
import type { AssetsStackParamList } from '../navigation/types';
import { theme } from '../theme';

type Props = NativeStackScreenProps<AssetsStackParamList, 'AssetListMain'>;

// Feature D placeholder — Feature G builds the real area/location-locked,
// searchable asset list.
export function AssetListScreen({ navigation }: Props) {
  return (
    <Screen title="Assets">
      <SectionHead title="Asset list" />
      <Card style={{ padding: theme.spacing.lg, gap: 4 }}>
        <Text style={theme.text.cardTitle}>Your assets land here</Text>
        <Text style={theme.text.caption}>
          The area-locked asset list with search and filters arrives with Feature G.
        </Text>
      </Card>

      {__DEV__ && (
        // Pushes this same route again — the only way to prove the pill + FAB
        // float over pushed screens until Feature G adds a real Asset Detail.
        <Pressable
          onPress={() => navigation.push('AssetListMain')}
          style={({ pressed }) => ({
            marginTop: theme.spacing.lg,
            alignSelf: 'flex-start',
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.line,
            backgroundColor: pressed ? theme.colors.bg : theme.colors.white,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 8,
          })}
        >
          <Text style={[theme.text.caption, { color: theme.colors.ink }]}>
            DEV · Push test screen
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}
