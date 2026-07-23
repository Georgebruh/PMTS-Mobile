// Structural views of the untyped .js asset-related models (tsconfig has
// allowJs without checkJs, so model fields read as `any`). One cast at each
// query boundary keeps everything downstream strictly typed — same convention
// as src/wo/types.ts.

/** The rich asset record Feature G reads (superset of wo/types' AssetRecord). */
export type AssetRecord = {
  id: string;
  assetCode: string;
  equipmentName: string;
  equipmentNo: string;
  tier: number;
  site: string;
  location: string;
  code: string;
  assetNumber: string | null;
  assetType: string;
  specs: string | null;
  healthPct: number | null;
  currentStatusColor: string;
  inChargeEmail: string;
  active: boolean;
  /** WatermelonDB-managed, bumped on every local write and every synced-in
   *  update. Feature N fingerprints the list hooks and row memo on it. */
  updatedAt: Date | null;
};

export type AssetHistoryRecord = {
  id: string;
  historyCode: string;
  eventType: string;
  statusColor: string | null;
  actor: string | null;
  notes: string | null;
  eventAt: Date | null;
  workOrderId: string | null;
  reportId: string | null;
};

export type PmsScheduleRecord = {
  id: string;
  scheduleCode: string;
  dueDate: Date | null;
  frequencyType: string;
  generated: boolean;
};
