import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAreaLock } from '../asset/hooks';
import { useRole } from '../auth/session';
import type { AssetsStackParamList } from '../navigation/types';
import { AssetListL1 } from './assets/AssetListL1';
import { AssetListL2 } from './assets/AssetListL2';

type Props = NativeStackScreenProps<AssetsStackParamList, 'AssetListMain'>;

// Feature G — the real Asset List. The two roles are separate components (not
// branches inside one) so an Act-as-L1 flip remounts the whole observable tree
// under the tighter lock, exactly like the dashboards.
export function AssetListScreen({ navigation }: Props) {
  const role = useRole();
  const lock = useAreaLock();

  const openAsset = (assetId: string) => navigation.navigate('AssetDetail', { assetId });

  if (role === null) return null; // signed out; the root navigator is unmounting

  return role === 1 ? (
    <AssetListL1 lock={lock} onOpenAsset={openAsset} />
  ) : (
    <AssetListL2 lock={lock} onOpenAsset={openAsset} />
  );
}
