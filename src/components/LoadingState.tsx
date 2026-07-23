import { ActivityIndicator, Text, View } from 'react-native';

import { theme } from '../theme';
import { Card } from './Card';

type Props = {
  /** Optional caption below the spinner; defaults to nothing. */
  caption?: string;
};

/**
 * Feature N — a centered loading indicator for screens whose observable data
 * has not emitted once yet. Styled consistently with EmptyState (same Card
 * container, same padding) so swapping between them is visually seamless.
 */
export function LoadingState({ caption }: Props) {
  return (
    <Card
      style={{
        padding: theme.spacing.lg,
        alignItems: 'center',
        gap: caption ? 10 : 0,
      }}
    >
      <View style={{ paddingVertical: 6 }}>
        <ActivityIndicator size="small" color={theme.colors.maroon} />
      </View>
      {caption !== undefined && <Text style={theme.text.caption}>{caption}</Text>}
    </Card>
  );
}
