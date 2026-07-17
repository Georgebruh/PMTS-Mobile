import type { ViewStyle } from 'react-native';

// RN translations of the mockup's three shadows: iOS gets shadow*, Android
// gets elevation (the layered CSS shadows collapse to a single approximation).

// .asset-card / .info-card: 0 1px 2px rgba(70,20,18,.04), 0 8px 20px -8px rgba(70,20,18,.12)
export const card: ViewStyle = {
  shadowColor: '#461412',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 3,
};

// .nav-pill / .fab: 0 12px 24px -10px rgba(180,24,26,.5)
export const floating: ViewStyle = {
  shadowColor: '#B4181A',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 8,
};

// .btn.primary: 0 10px 20px -10px rgba(180,24,26,.55)
export const primaryButton: ViewStyle = {
  shadowColor: '#B4181A',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.45,
  shadowRadius: 10,
  elevation: 6,
};

export const shadows = { card, floating, primaryButton } as const;
