import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import migrations from './migrations'
import schema from './schema'
import {
  User, Asset, PmsSchedule, WorkOrder, WorkOrderCrew,
  MaintenanceReport, ReportParameter, AssetHistory, PendingUpload,
} from './models'

const adapter = new SQLiteAdapter({
  schema,
  // Without this, a schema version bump makes WatermelonDB reset the database
  // rather than migrate it — destroying local writes that have not been pushed.
  migrations,
  jsi: false, // JSI native mods disabled — async bridge is fine for our data volume
  onSetUpError: (error) => {
    console.error('WatermelonDB setup failed:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [
    User,
    Asset,
    PmsSchedule,
    WorkOrder,
    WorkOrderCrew,
    MaintenanceReport,
    ReportParameter,
    AssetHistory,
    PendingUpload,
  ],
})


export async function wipeLocalDatabase() {
  await database.write(async () => {
    await database.unsafeResetDatabase()
  })
}
