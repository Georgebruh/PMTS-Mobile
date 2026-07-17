import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'user_code', type: 'string', isIndexed: true },      // display id e.g. U-001
        { name: 'full_name', type: 'string' },
        { name: 'email', type: 'string', isIndexed: true },          // login + area-lock match
        { name: 'role_level', type: 'number' },                      // 1 / 2 / 3
        { name: 'is_lead', type: 'boolean' },
        { name: 'assigned_area', type: 'string' },                   // "MEZ2" or "MEZ2;CBU"
        { name: 'assigned_locations', type: 'string', isOptional: true },
        { name: 'active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'assets',
      columns: [
        { name: 'asset_code', type: 'string', isIndexed: true },     // display id (Digital Asset No.)
        { name: 'equipment_name', type: 'string' },
        { name: 'equipment_no', type: 'string' },
        { name: 'tier', type: 'number', isIndexed: true },           // 1 / 2 / 3  (drives sort)
        { name: 'site', type: 'string', isIndexed: true },           // area-lock
        { name: 'location', type: 'string', isIndexed: true },       // location-lock
        { name: 'code', type: 'string' },
        { name: 'asset_number', type: 'string', isOptional: true },
        { name: 'asset_type', type: 'string' },
        { name: 'specs', type: 'string', isOptional: true },
        { name: 'health_pct', type: 'number', isOptional: true },
        { name: 'current_status_color', type: 'string' },            // green/orange/red/black
        { name: 'in_charge_email', type: 'string' },                 // kept as plain string
        { name: 'active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'pms_schedule',
      columns: [
        { name: 'schedule_code', type: 'string', isIndexed: true },
        { name: 'asset_id', type: 'string', isIndexed: true },       // FK -> assets (WMDB id)
        { name: 'week_no', type: 'number' },                         // 1..52
        { name: 'due_date', type: 'number' },                        // unix ms
        { name: 'frequency_type', type: 'string' },                  // D/W/M/Q/SA/A
        { name: 'generated', type: 'boolean' },                      // idempotency flag
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'work_orders',
      columns: [
        { name: 'wo_code', type: 'string', isIndexed: true },        // display id e.g. WO-2026-000123
        { name: 'asset_id', type: 'string', isIndexed: true },       // FK -> assets
        { name: 'tier', type: 'number', isIndexed: true },           // denormalized for sort
        { name: 'wo_type', type: 'string' },                         // PMS / REPAIR / REWORK
        { name: 'source_report_id', type: 'string', isOptional: true }, // FK -> maintenance_reports
        { name: 'status', type: 'string', isIndexed: true },         // state machine
        { name: 'assigned_to', type: 'string', isOptional: true, isIndexed: true }, // FK -> users
        { name: 'assigned_by', type: 'string', isOptional: true },
        { name: 'assigned_at', type: 'number', isOptional: true },
        { name: 'due_date', type: 'number', isOptional: true },
        { name: 'created_by', type: 'string' },
        { name: 'started_at', type: 'number', isOptional: true },
        { name: 'ended_at', type: 'number', isOptional: true },
        { name: 'site', type: 'string', isIndexed: true },           // denormalized area-lock
        { name: 'location', type: 'string', isIndexed: true },       // denormalized location-lock
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'work_order_crew',
      columns: [
        { name: 'crew_code', type: 'string', isIndexed: true },
        { name: 'work_order_id', type: 'string', isIndexed: true },  // FK -> work_orders
        { name: 'worker_name', type: 'string' },                     // free text, phone-less workers
        { name: 'added_by', type: 'string' },                        // FK -> users (code/id)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'maintenance_reports',
      columns: [
        { name: 'report_code', type: 'string', isIndexed: true },
        { name: 'work_order_id', type: 'string', isIndexed: true },  // FK -> work_orders
        { name: 'asset_id', type: 'string', isIndexed: true },       // FK -> assets (denormalized)
        { name: 'action_taken', type: 'string', isOptional: true },
        { name: 'status_color', type: 'string', isOptional: true },  // green/orange/red/black
        { name: 'photo_urls', type: 'string', isOptional: true },    // ';'-joined Drive URLs
        { name: 'signature_url', type: 'string', isOptional: true },
        { name: 'reporter_user_id', type: 'string' },
        { name: 'is_draft', type: 'boolean', isIndexed: true },      // drives Unfinished count
        { name: 'submitted_at', type: 'number', isOptional: true },
        { name: 'approval_status', type: 'string', isIndexed: true },// PENDING/APPROVED/REJECTED
        { name: 'approved_by', type: 'string', isOptional: true },
        { name: 'approved_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'report_parameters',
      columns: [
        { name: 'param_code', type: 'string', isIndexed: true },
        { name: 'report_id', type: 'string', isIndexed: true },      // FK -> maintenance_reports
        { name: 'param_name', type: 'string' },
        { name: 'unit', type: 'string', isOptional: true },
        { name: 'measured_value', type: 'string' },                  // text for flexibility
        { name: 'sort_order', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'asset_history',
      columns: [
        { name: 'history_code', type: 'string', isIndexed: true },
        { name: 'asset_id', type: 'string', isIndexed: true },       // FK -> assets
        { name: 'event_type', type: 'string' },
        { name: 'work_order_id', type: 'string', isOptional: true }, // FK -> work_orders
        { name: 'report_id', type: 'string', isOptional: true },     // FK -> maintenance_reports
        { name: 'status_color', type: 'string', isOptional: true },
        { name: 'actor', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'event_at', type: 'number' },                        // unix ms — when it happened
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
})
