import { createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

import { pendingUploadColumns } from './schema'

/**
 * The project's first schema migration (Feature I).
 *
 * This file is not optional bookkeeping. When the schema version moves and
 * WatermelonDB has no migration path for the jump, it does not fail loudly —
 * it RESETS the local database. On a field phone that means silently deleting
 * work orders started offline and crew names not yet pushed, i.e. exactly the
 * data Feature H exists to protect. Every future version bump needs a step
 * here, added in the same commit as the schema change.
 *
 * v1 → v2: adds the local-only `pending_uploads` queue. Built from the same
 * exported column array the schema uses, so the migrated table and a
 * freshly-created one are the same table by construction.
 */
export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [createTable({ name: 'pending_uploads', columns: pendingUploadColumns })],
    },
  ],
})
