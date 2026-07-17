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
