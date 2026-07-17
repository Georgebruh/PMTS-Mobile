import { Q } from '@nozbe/watermelondb';

import { database } from '../database/database';
import type { SessionUser } from './api';

/**
 * Mirrors the logged-in user's row into the local `users` table so role
 * detection works offline before Feature C sync exists.
 *
 * The server owns `users` rows, so this write must never enter the push
 * queue: clearing `_raw._status`/`_raw._changed` as the LAST step of the
 * create/update callback bypasses WatermelonDB's change marking (field
 * setters run through _setRaw, which marks first).
 */
export async function upsertLocalUser(user: SessionUser): Promise<void> {
  const users = database.get('users');
  await database.write(async () => {
    const apply = (u: any) => {
      u.userCode = user.user_code;
      u.fullName = user.full_name;
      u.email = user.email;
      u.roleLevel = user.role_level;
      u.isLead = user.is_lead;
      u.assignedArea = user.assigned_area;
      u.assignedLocations = user.assigned_locations;
      u.active = user.active;
      u._raw._status = 'synced';
      u._raw._changed = '';
    };

    const existing = await users.query(Q.where('id', user.id)).fetch();
    if (existing.length > 0) {
      await existing[0].update(apply);
    } else {
      await users.create((u: any) => {
        u._raw.id = user.id; // WatermelonDB id === server client_uuid
        apply(u);
      });
    }
  });
}
