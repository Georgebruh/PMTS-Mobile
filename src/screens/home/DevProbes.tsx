import { Q } from '@nozbe/watermelondb';
import { Alert, Pressable, Text } from 'react-native';

import { areaLockFor, assetLockClauses, matchesLockJs, parseList } from '../../asset/lock';
import {
  activeAssetClause,
  assetCompare,
  assetFilterClauses,
  distinctValues,
  matchesAssetFilterJs,
} from '../../asset/queries';
import type { AssetRecord } from '../../asset/types';
import { useSession } from '../../auth/session';
import { Card } from '../../components/Card';
import { database } from '../../database/database';
import { theme } from '../../theme';
import { chipsForRole } from '../../wo/chips';
import { todayBounds } from '../../wo/dates';
import {
  draftReportClauses,
  matchesDraftJs,
  matchesFilterJs,
  progressClauses,
  woClauses,
  woCompare,
  FILTER_TITLES,
} from '../../wo/queries';
import { WO_STATUS } from '../../wo/status';
import type { ReportRecord, WoRecord } from '../../wo/types';

// Dev-only dashboard harness (mounted behind __DEV__). Probe rule: run in
// airplane mode and delete before reconnecting — a created-then-destroyed
// local row never pushes. The marker strings make any leaked row easy to hand
// clean from the sheet; push is upsert-by-id, so re-pushes can't duplicate.
const DRAFT_MARKER = 'TEST_DRAFT_E';
const WO_CODES = ['TEST-E-1', 'TEST-E-2', 'TEST-E-3'];

// Feature F fixture: every status, every tier, null due dates, and rows
// assigned to somebody else — created in shuffled order so the frozen sort
// (tier → due nulls-last → code) is non-trivially exercised.
const WO_CODES_F = [
  'TEST-F-1',
  'TEST-F-2',
  'TEST-F-3',
  'TEST-F-4',
  'TEST-F-5',
  'TEST-F-6',
  'TEST-F-7',
  'TEST-F-8',
];
/** Fake assignee id — matches no real user, exercising the L1 me-scope. */
const OTHER_USER = 'TEST-F-OTHER';

// Feature G fixture: mirrors the Node harness's asset set exactly, but built
// from the SIGNED-IN user's own area/locations so the lock is exercised
// against real values. Two rows are deliberately out of scope.
const ASSET_CODES_G = ['TEST-G-1', 'TEST-G-2', 'TEST-G-3', 'TEST-G-4', 'TEST-G-5'];
const OUT_AREA = 'ZZ-OUT-OF-AREA';
const OUT_LOC = 'ZZ-OUT-OF-LOCATION';

type Props = {
  userId: string;
  role: 1 | 2;
};

export function DevProbes({ userId, role }: Props) {
  const user = useSession((s) => s.user);
  // Feature I doesn't exist yet, so this simulates its draft write: press once
  // to create a draft report (Unfinished must bump instantly, no sync), press
  // again to remove it.
  const toggleDraft = async () => {
    const drafts = await database
      .get('maintenance_reports')
      .query(Q.where('action_taken', DRAFT_MARKER), Q.where('reporter_user_id', userId))
      .fetch();
    if (drafts.length > 0) {
      await database.write(async () => {
        for (const draft of drafts) await draft.destroyPermanently();
      });
      return;
    }

    const wos = await database.get('work_orders').query(Q.take(1)).fetch();
    if (wos.length === 0) {
      Alert.alert('No work orders yet', 'Seed test WOs first, or sync some in.');
      return;
    }
    const wo: any = wos[0];
    await database.write(async () => {
      await database.get('maintenance_reports').create((r: any) => {
        r.workOrder.set(wo);
        r.asset.id = wo.asset.id;
        r.reportCode = ''; // display codes are server-assigned
        r.actionTaken = DRAFT_MARKER;
        r.isDraft = true;
        r.reporterUserId = userId;
        r.approvalStatus = '';
      });
    });
  };

  // Known fixture: Due Today = 2, Overdue = 1, progress 1/2 = 50%, and the
  // preview must order T1 → T2 → T3. Press again to delete the fixture.
  const toggleSeedWos = async () => {
    const existing = await database
      .get('work_orders')
      .query(Q.where('wo_code', Q.oneOf(WO_CODES)))
      .fetch();
    if (existing.length > 0) {
      await database.write(async () => {
        for (const wo of existing) await wo.destroyPermanently();
      });
      return;
    }

    const assets = await database.get('assets').query(Q.take(1)).fetch();
    if (assets.length === 0) {
      Alert.alert('No assets yet', 'Seed the assets tab in the sheet and sync first.');
      return;
    }
    const asset: any = assets[0];
    const bounds = todayBounds();
    const rows = [
      {
        code: 'TEST-E-1',
        tier: 1,
        status: WO_STATUS.IN_PROGRESS,
        due: new Date(bounds.start - 15 * 60 * 60 * 1000), // yesterday → Overdue
      },
      {
        code: 'TEST-E-2',
        tier: 2,
        status: WO_STATUS.ASSIGNED,
        due: new Date(bounds.start + 9 * 60 * 60 * 1000), // today
      },
      {
        code: 'TEST-E-3',
        tier: 3,
        status: WO_STATUS.COMPLETED,
        due: new Date(bounds.start + 9 * 60 * 60 * 1000), // today, done → progress
      },
    ];
    await database.write(async () => {
      for (const row of rows) {
        await database.get('work_orders').create((w: any) => {
          w.asset.set(asset);
          w.woCode = row.code;
          w.tier = row.tier;
          w.woType = 'PMS';
          w.status = row.status;
          w.assignedTo = userId;
          w.createdBy = userId;
          w.dueDate = row.due;
          w.site = asset.site;
          w.location = asset.location;
        });
      }
    });
  };

  // Feature F fixture. Expected counts with ONLY this fixture in the DB —
  // L2 chips: open 6 · today 2 · overdue 2 · unassigned 1 · assigned 3 ·
  // completed 1 · approval 1; open order F1→F2→F3→F4→F5→F7.
  // L1 chips (me): open 3 · today 2 · overdue 1; open order F1→F2→F4.
  const toggleSeedWosF = async () => {
    const existing = await database
      .get('work_orders')
      .query(Q.where('wo_code', Q.oneOf(WO_CODES_F)))
      .fetch();
    if (existing.length > 0) {
      await database.write(async () => {
        for (const wo of existing) await wo.destroyPermanently();
      });
      return;
    }

    const assets = await database.get('assets').query(Q.take(1)).fetch();
    if (assets.length === 0) {
      Alert.alert('No assets yet', 'Seed the assets tab in the sheet and sync first.');
      return;
    }
    const asset: any = assets[0];
    const bounds = todayBounds();
    const yesterday = new Date(bounds.start - 15 * 60 * 60 * 1000);
    const today = new Date(bounds.start + 9 * 60 * 60 * 1000);
    const tomorrow = new Date(bounds.start + 33 * 60 * 60 * 1000);

    // Creation order is deliberately shuffled versus the expected sort.
    const rows: {
      code: string;
      tier: number;
      status: string;
      due: Date | null;
      who: string | null;
    }[] = [
      { code: 'TEST-F-5', tier: 2, status: WO_STATUS.PENDING_APPROVAL, due: tomorrow, who: OTHER_USER },
      { code: 'TEST-F-1', tier: 1, status: WO_STATUS.IN_PROGRESS, due: yesterday, who: userId },
      { code: 'TEST-F-8', tier: 3, status: WO_STATUS.CLOSED, due: today, who: OTHER_USER },
      { code: 'TEST-F-3', tier: 1, status: WO_STATUS.UNASSIGNED, due: null, who: null },
      { code: 'TEST-F-6', tier: 2, status: WO_STATUS.CLOSED, due: null, who: userId },
      { code: 'TEST-F-2', tier: 1, status: WO_STATUS.ASSIGNED, due: today, who: userId },
      { code: 'TEST-F-7', tier: 3, status: WO_STATUS.ASSIGNED, due: yesterday, who: OTHER_USER },
      { code: 'TEST-F-4', tier: 2, status: WO_STATUS.COMPLETED, due: today, who: userId },
    ];
    await database.write(async () => {
      for (const row of rows) {
        await database.get('work_orders').create((w: any) => {
          w.asset.set(asset);
          w.woCode = row.code;
          w.tier = row.tier;
          w.woType = 'PMS';
          w.status = row.status;
          w.assignedTo = row.who;
          w.createdBy = userId;
          w.dueDate = row.due;
          w.site = asset.site;
          w.location = asset.location;
        });
      }
    });
  };

  // Feature G fixture. Expected with ONLY this fixture seeded —
  // as L1 (area + location lock): 3 assets, order G-1 → G-5 → G-2.
  // as L2 (area lock only):       4 assets, order G-1 → G-5 → G-3 → G-2.
  // TEST-G-4 is out of area and must NEVER appear for either role.
  // G-1 also carries 3 history events, a past + future PMS row, and one open
  // WO assigned to me (the detail's "View Work Order" jump).
  const toggleSeedAssetsG = async () => {
    const existing = await database
      .get('assets')
      .query(Q.where('asset_code', Q.oneOf(ASSET_CODES_G)))
      .fetch();

    if (existing.length > 0) {
      const ids = existing.map((a) => a.id);
      const [history, schedules, wos] = await Promise.all([
        database.get('asset_history').query(Q.where('asset_id', Q.oneOf(ids))).fetch(),
        database.get('pms_schedule').query(Q.where('asset_id', Q.oneOf(ids))).fetch(),
        database.get('work_orders').query(Q.where('asset_id', Q.oneOf(ids))).fetch(),
      ]);
      await database.write(async () => {
        // Children first — nothing may outlive the asset it hangs off.
        for (const row of [...history, ...schedules, ...wos, ...existing]) {
          await row.destroyPermanently();
        }
      });
      return;
    }

    const area = parseList(user?.assigned_area)[0] ?? 'AREA-1';
    const location = parseList(user?.assigned_locations)[0] ?? 'LOC-1';
    const rows = [
      { code: 'TEST-G-1', name: 'Alpha Pump', tier: 1, site: area, location, color: 'green', type: 'Land Development', health: 92 },
      { code: 'TEST-G-2', name: 'Bravo Valve', tier: 2, site: area, location, color: 'red', type: 'Land Development', health: null },
      { code: 'TEST-G-3', name: 'Charlie Panel', tier: 1, site: area, location: OUT_LOC, color: 'orange', type: 'Electrical', health: null },
      { code: 'TEST-G-4', name: 'Delta Fence', tier: 3, site: OUT_AREA, location: OUT_LOC, color: 'black', type: 'Electrical', health: null },
      // Same tier AND name as G-1 — proves the asset-code tie-break.
      { code: 'TEST-G-5', name: 'Alpha Pump', tier: 1, site: area, location, color: 'green', type: 'Land Development', health: null },
    ];

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    await database.write(async () => {
      const created: any[] = [];
      for (const row of rows) {
        const asset = await database.get('assets').create((a: any) => {
          a.assetCode = row.code;
          a.equipmentName = row.name;
          a.equipmentNo = row.code;
          a.tier = row.tier;
          a.site = row.site;
          a.location = row.location;
          a.code = row.code;
          a.assetType = row.type;
          a.specs = row.health !== null ? '415V · 30kW' : null;
          a.healthPct = row.health;
          a.currentStatusColor = row.color;
          a.inChargeEmail = user?.email ?? '';
          a.active = true;
        });
        created.push(asset);
      }

      const g1 = created[0];
      // Seeded out of order so the newest-first timeline sort is non-trivial.
      const events = [
        { type: 'STATUS_CHANGE', color: 'orange', at: now - 2 * DAY, notes: 'Vibration above threshold' },
        { type: 'CREATED', color: 'green', at: now - 30 * DAY, notes: 'Commissioned' },
        { type: 'WO_COMPLETED', color: 'green', at: now - 1 * DAY, notes: 'Bearing replaced' },
      ];
      for (const event of events) {
        await database.get('asset_history').create((h: any) => {
          h.asset.set(g1);
          h.historyCode = ''; // display codes are server-assigned
          h.eventType = event.type;
          h.statusColor = event.color;
          h.actor = userId;
          h.notes = event.notes;
          h.eventAt = new Date(event.at);
        });
      }

      // One past + one future row → Last Inspection / Next Inspection.
      for (const due of [now - 200 * DAY, now + 10 * DAY]) {
        await database.get('pms_schedule').create((p: any) => {
          p.asset.set(g1);
          p.scheduleCode = '';
          p.weekNo = 1;
          p.dueDate = new Date(due);
          p.frequencyType = 'A';
          p.generated = false;
        });
      }

      await database.get('work_orders').create((w: any) => {
        w.asset.set(g1);
        w.woCode = 'TEST-G-WO';
        w.tier = 1;
        w.woType = 'PMS';
        w.status = WO_STATUS.ASSIGNED;
        w.assignedTo = userId;
        w.createdBy = userId;
        w.dueDate = new Date(now);
        w.site = g1.site;
        w.location = g1.location;
      });
    });
  };

  // Feature G's standing hand query: the lock and every reachable filter
  // counted through the shared Q-clauses AND through the independent plain-JS
  // matchers, plus the exact row order the Asset List must display.
  const dumpAssetCounts = async () => {
    const lock = areaLockFor({
      assigned_area: user?.assigned_area ?? '',
      assigned_locations: user?.assigned_locations ?? '',
    });
    const lockClauses = assetLockClauses(role, lock);

    const all = (await database.get('assets').query().fetch()) as unknown as AssetRecord[];
    const visible = (await database
      .get('assets')
      .query(activeAssetClause(), ...lockClauses)
      .fetch()) as unknown as AssetRecord[];

    const sqlLock = visible.length;
    const jsLock = all.filter((a) => a.active && matchesLockJs(a, role, lock)).length;

    const lines: string[] = [
      `Role: L${role} (${role === 1 ? 'area + location' : 'area only'})`,
      `areas=[${lock.areas.join(', ')}] locations=[${lock.locations.join(', ')}]`,
      `Lock: sql=${sqlLock} js=${jsLock}${sqlLock === jsLock ? '' : '  ⚠ MISMATCH'}`,
      `Total in DB: ${all.length}`,
    ];

    const order = [...visible]
      .sort(assetCompare)
      .map((a) => a.assetCode || a.id.slice(0, 4))
      .join(' → ');
    lines.push(`Order: ${order || '(empty)'}`);

    // The done-when, stated directly: what the lock is keeping out of view.
    const hidden = all
      .filter((a) => a.active && !matchesLockJs(a, role, lock))
      .map((a) => a.assetCode || a.id.slice(0, 4));
    lines.push(`Hidden from you (${hidden.length}): ${hidden.join(', ') || '(none)'}`);

    for (const type of distinctValues(visible, (a) => a.assetType)) {
      const sql = await database
        .get('assets')
        .query(activeAssetClause(), ...lockClauses, ...assetFilterClauses({ type }))
        .fetchCount();
      const js = visible.filter((a) => matchesAssetFilterJs(a, { type })).length;
      lines.push(`type=${type}: sql=${sql} js=${js}${sql === js ? '' : '  ⚠ MISMATCH'}`);
    }

    for (const status of distinctValues(visible, (a) => a.currentStatusColor)) {
      const sql = await database
        .get('assets')
        .query(activeAssetClause(), ...lockClauses, ...assetFilterClauses({ status }))
        .fetchCount();
      const js = visible.filter((a) => matchesAssetFilterJs(a, { status })).length;
      lines.push(`status=${status}: sql=${sql} js=${js}${sql === js ? '' : '  ⚠ MISMATCH'}`);
    }

    console.log(`[DevProbes] asset dump\n${lines.join('\n')}`);
    Alert.alert('Asset lock + filters (sql vs js)', lines.join('\n'));
  };

  // The done-when's standing "hand query": for every CHIP of the current
  // effective role (a superset of the dashboard cards), count via the shared
  // Q-clauses AND via the independent plain-JS matcher over a full-table
  // fetch. Both must equal the on-screen number.
  const dumpCounts = async () => {
    const bounds = todayBounds();
    const chips = chipsForRole(role, userId);

    const allWos = (await database
      .get('work_orders')
      .query()
      .fetch()) as unknown as WoRecord[];

    const lines: string[] = [];
    for (const chip of chips) {
      if (chip.kind === 'myDrafts') continue; // report-table three-way below
      const sql = await database
        .get('work_orders')
        .query(...woClauses(chip.filter, bounds))
        .fetchCount();
      const js = allWos.filter((wo) => matchesFilterJs(wo, chip.filter, bounds)).length;
      lines.push(
        `${chip.label}: sql=${sql} js=${js}${sql === js ? '' : '  ⚠ MISMATCH'}`,
      );
    }

    // The frozen order the list screen must show for the open chip — compare
    // by eye against the on-screen row order.
    const openChip = chips.find((c) => c.kind === 'open');
    if (openChip) {
      const openRows = (await database
        .get('work_orders')
        .query(...woClauses(openChip.filter, bounds))
        .fetch()) as unknown as WoRecord[];
      const order = [...openRows]
        .sort(woCompare)
        .map((w) => w.woCode || w.id.slice(0, 4))
        .join(' → ');
      lines.push(`Open order: ${order || '(empty)'}`);
    }

    if (role === 1) {
      const sqlDrafts = await database
        .get('maintenance_reports')
        .query(...draftReportClauses(userId))
        .fetchCount();
      const allReports = (await database
        .get('maintenance_reports')
        .query()
        .fetch()) as unknown as ReportRecord[];
      const jsDrafts = allReports.filter((r) => matchesDraftJs(r, userId)).length;
      lines.push(
        `${FILTER_TITLES.myDrafts}: sql=${sqlDrafts} js=${jsDrafts}${sqlDrafts === jsDrafts ? '' : '  ⚠ MISMATCH'}`,
      );

      const { denom, numer } = progressClauses(userId, bounds);
      const done = await database.get('work_orders').query(...numer).fetchCount();
      const total = await database.get('work_orders').query(...denom).fetchCount();
      lines.push(`Progress: done=${done} / total=${total}`);
    }

    console.log(`[DevProbes] count dump\n${lines.join('\n')}`);
    Alert.alert('Dashboard counts (sql vs js)', lines.join('\n'));
  };

  return (
    <Card style={{ marginTop: theme.spacing.md, padding: theme.spacing.lg, gap: theme.spacing.sm }}>
      <Text style={theme.text.cardTitle}>DEV · Dashboard + list probes</Text>
      <Text style={theme.text.caption}>
        Airplane mode on → probe → verify → delete → airplane mode off. Deleted-before-sync rows
        never reach the sheet.
      </Text>
      <DevButton label="Toggle draft report (Unfinished ±1, no sync)" onPress={toggleDraft} />
      <DevButton label="Toggle 3 seed WOs (Today 2 · Overdue 1 · 50%)" onPress={toggleSeedWos} />
      <DevButton label="Toggle 8 F-fixture WOs (all statuses · tiers · null dues)" onPress={toggleSeedWosF} />
      <DevButton label="Dump chip counts (sql vs js) + open order" onPress={dumpCounts} />
      <DevButton
        label="Toggle 5 G-fixture assets (2 out of scope · history · PMS · WO)"
        onPress={toggleSeedAssetsG}
      />
      <DevButton label="Dump asset lock + filters (sql vs js) + order" onPress={dumpAssetCounts} />
    </Card>
  );
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.line,
        backgroundColor: pressed ? theme.colors.bg : theme.colors.white,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 8,
      })}
    >
      <Text style={[theme.text.caption, { color: theme.colors.ink }]}>{label}</Text>
    </Pressable>
  );
}
