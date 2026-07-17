import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './schema'
import {
  User, Asset, PmsSchedule, WorkOrder, WorkOrderCrew,
  MaintenanceReport, ReportParameter, AssetHistory,
} from './models'

const adapter = new SQLiteAdapter({
  schema,
  jsi: true, // native JSI path — needs a dev build, not Expo Go
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
  ],
})

/**
 * Feature C wipe-on-user-switch: drops every table AND WatermelonDB's own
 * lastPulledAt, so the next sync is a clean full pull. Only ever call before
 * the new user's first local write (see session.signIn).
 */
export async function wipeLocalDatabase() {
  await database.write(async () => {
    await database.unsafeResetDatabase()
  })
}
