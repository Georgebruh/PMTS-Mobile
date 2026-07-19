import { Children, type ReactNode } from 'react';
import { View } from 'react-native';

// Two-column stat-card grid; an odd trailing card stretches full width
// (L1's 3 cards → 2+1, L2's 5 → 2+2+1).
export function StatGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  return (
    <View style={{ gap: 10 }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map((item, colIndex) => (
            <View key={colIndex} style={{ flex: 1 }}>
              {item}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
