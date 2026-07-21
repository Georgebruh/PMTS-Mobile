import { Q } from '@nozbe/watermelondb';
import { Alert, Pressable, Text } from 'react-native';

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

type Props = {
  userId: string;
  role: 1 | 2;
};

export function DevProbes({ userId, role }: Props) {
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
