// Feature L — structural views the staff domain needs, mirroring src/wo/types.ts
// and src/report/types.ts. One cast at the query boundary, strict downstream.
//
// The work-order and report shapes are reused from their own modules; the only
// new shape here is UserRecord, because Feature L is the first screen that reads
// the users table for anything but the signed-in account (gap #8: there is no
// @relation from assigned_to / reporter_user_id to users, so names are resolved
// by id against these rows).

/**
 * A users row as the staff screens read it. `roleLevel`/`active` come off the
 * untyped model as their decorated types (number / boolean); the area strings
 * are the raw ';'-delimited sheet cells.
 */
export type UserRecord = {
  id: string;
  userCode: string;
  fullName: string;
  email: string;
  roleLevel: number;
  isLead: boolean;
  assignedArea: string;
  assignedLocations: string | null;
  active: boolean;
};
