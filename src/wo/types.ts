// Minimal structural views of the untyped .js model classes (tsconfig has
// allowJs without checkJs, so model fields read as `any`). One cast at the
// query boundary keeps everything downstream strictly typed.

/**
 * rxjs-like observable surface. rxjs is only a transitive dependency of
 * WatermelonDB, so app code subscribes through this structural type instead
 * of importing it.
 */
export type Subscribable<T> = {
  subscribe(observer: {
    next: (value: T) => void;
    error: (err: unknown) => void;
  }): { unsubscribe(): void };
};

export type AssetRecord = {
  id: string;
  equipmentName: string;
  assetCode: string;
  site: string;
  location: string;
};

export type WoRecord = {
  id: string;
  woCode: string;
  tier: number;
  woType: string;
  status: string;
  assignedTo: string | null;
  dueDate: Date | null;
  site: string;
  location: string;
  asset: {
    id: string;
    observe(): Subscribable<AssetRecord | null>;
  };
};

export type ReportRecord = {
  id: string;
  isDraft: boolean;
  reporterUserId: string;
  actionTaken: string | null;
};

/** The one sanctioned cast from a WatermelonDB observable to a typed stream. */
export function asSubscribable<T>(observable: unknown): Subscribable<T> {
  return observable as Subscribable<T>;
}
