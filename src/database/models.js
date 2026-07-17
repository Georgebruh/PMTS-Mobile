import { Model } from '@nozbe/watermelondb'
import { field, text, date, readonly, relation, children } from '@nozbe/watermelondb/decorators'

export class User extends Model {
  static table = 'users'

  @text('user_code') userCode
  @text('full_name') fullName
  @text('email') email
  @field('role_level') roleLevel
  @field('is_lead') isLead
  @text('assigned_area') assignedArea
  @text('assigned_locations') assignedLocations
  @field('active') active
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt
}

export class Asset extends Model {
  static table = 'assets'
  static associations = {
    work_orders: { type: 'has_many', foreignKey: 'asset_id' },
    asset_history: { type: 'has_many', foreignKey: 'asset_id' },
    pms_schedule: { type: 'has_many', foreignKey: 'asset_id' },
  }

  @text('asset_code') assetCode
  @text('equipment_name') equipmentName
  @text('equipment_no') equipmentNo
  @field('tier') tier
  @text('site') site
  @text('location') location
  @text('code') code
  @text('asset_number') assetNumber
  @text('asset_type') assetType
  @text('specs') specs
  @field('health_pct') healthPct
  @text('current_status_color') currentStatusColor
  @text('in_charge_email') inChargeEmail
  @field('active') active
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt

  @children('work_orders') workOrders
  @children('asset_history') history
  @children('pms_schedule') pmsSchedule
}

export class PmsSchedule extends Model {
  static table = 'pms_schedule'
  static associations = {
    assets: { type: 'belongs_to', key: 'asset_id' },
  }

  @text('schedule_code') scheduleCode
  @field('week_no') weekNo
  @date('due_date') dueDate
  @text('frequency_type') frequencyType
  @field('generated') generated
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt

  @relation('assets', 'asset_id') asset
}

export class WorkOrder extends Model {
  static table = 'work_orders'
  static associations = {
    assets: { type: 'belongs_to', key: 'asset_id' },
    work_order_crew: { type: 'has_many', foreignKey: 'work_order_id' },
    maintenance_reports: { type: 'has_many', foreignKey: 'work_order_id' },
  }

  @text('wo_code') woCode
  @field('tier') tier
  @text('wo_type') woType
  @text('source_report_id') sourceReportId
  @text('status') status
  @text('assigned_to') assignedTo
  @text('assigned_by') assignedBy
  @date('assigned_at') assignedAt
  @date('due_date') dueDate
  @text('created_by') createdBy
  @date('started_at') startedAt
  @date('ended_at') endedAt
  @text('site') site
  @text('location') location
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt

  @relation('assets', 'asset_id') asset
  @children('work_order_crew') crew
  @children('maintenance_reports') reports
}

export class WorkOrderCrew extends Model {
  static table = 'work_order_crew'
  static associations = {
    work_orders: { type: 'belongs_to', key: 'work_order_id' },
  }

  @text('crew_code') crewCode
  @text('worker_name') workerName
  @text('added_by') addedBy
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt

  @relation('work_orders', 'work_order_id') workOrder
}

export class MaintenanceReport extends Model {
  static table = 'maintenance_reports'
  static associations = {
    work_orders: { type: 'belongs_to', key: 'work_order_id' },
    assets: { type: 'belongs_to', key: 'asset_id' },
    report_parameters: { type: 'has_many', foreignKey: 'report_id' },
  }

  @text('report_code') reportCode
  @text('action_taken') actionTaken
  @text('status_color') statusColor
  @text('photo_urls') photoUrls
  @text('signature_url') signatureUrl
  @text('reporter_user_id') reporterUserId
  @field('is_draft') isDraft
  @date('submitted_at') submittedAt
  @text('approval_status') approvalStatus
  @text('approved_by') approvedBy
  @date('approved_at') approvedAt
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt

  @relation('work_orders', 'work_order_id') workOrder
  @relation('assets', 'asset_id') asset
  @children('report_parameters') parameters
}

export class ReportParameter extends Model {
  static table = 'report_parameters'
  static associations = {
    maintenance_reports: { type: 'belongs_to', key: 'report_id' },
  }

  @text('param_code') paramCode
  @text('param_name') paramName
  @text('unit') unit
  @text('measured_value') measuredValue
  @field('sort_order') sortOrder
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt

  @relation('maintenance_reports', 'report_id') report
}

export class AssetHistory extends Model {
  static table = 'asset_history'
  static associations = {
    assets: { type: 'belongs_to', key: 'asset_id' },
  }

  @text('history_code') historyCode
  @text('event_type') eventType
  @text('work_order_id') workOrderId
  @text('report_id') reportId
  @text('status_color') statusColor
  @text('actor') actor
  @text('notes') notes
  @date('event_at') eventAt
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt

  @relation('assets', 'asset_id') asset
}
