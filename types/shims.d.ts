// Shims for untyped modules imported by Expo SDK 57's shipped TS source —
// without them `tsc --noEmit` fails inside node_modules. Not used by app code.

declare module '@react-native/assets-registry/registry' {
  export interface PackagerAsset {
    __packager_asset: boolean;
    fileSystemLocation: string;
    httpServerLocation: string;
    width?: number;
    height?: number;
    scales: number[];
    hash: string;
    name: string;
    type: string;
  }
  export function registerAsset(asset: any): number;
  export function getAssetByID(assetId: any): PackagerAsset | undefined;
}

declare module 'react-native/Libraries/Image/AssetSourceResolver' {
  export type ResolvedAssetSource = {
    __packager_asset: boolean;
    width?: number;
    height?: number;
    uri: string;
    scale: number;
  };
  export default class AssetSourceResolver {
    serverUrl?: string | null;
    jsbundleUrl?: string | null;
    asset: any;
    constructor(
      serverUrl: string | undefined | null,
      jsbundleUrl: string | undefined | null,
      asset: any,
    );
    defaultAsset(): ResolvedAssetSource;
    fromSource(source: string): ResolvedAssetSource;
    resourceIdentifierWithoutScale(): ResolvedAssetSource;
    static pickScale(scales: number[], deviceScale?: number): number;
  }
}

// expo/src/async-require/hmr.ts reads this off `window`.
interface Window {
  $$EXPO_INITIAL_PROPS?: unknown;
}
