import { synchronize } from '@nozbe/watermelondb/sync'
import { database } from './database'
import { API_URL } from '../config'

export async function sync(getToken) {
  if (!API_URL) {
    throw new Error(
      'PMTS gateway URL is not configured — set EXPO_PUBLIC_PMTS_API_URL in .env (see .env.example)',
    )
  }
  const API = API_URL

  await synchronize({
    database,

    pullChanges: async ({ lastPulledAt, schemaVersion }) => {
      const since = lastPulledAt ?? 0
      const res = await fetch(
        `${API}/sync?last_pulled_at=${since}&schema_version=${schemaVersion}`,
        { headers: { Authorization: `Bearer ${await getToken()}` } },
      )
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`)
      const { changes, timestamp } = await res.json()
      return { changes, timestamp }
    },

    pushChanges: async ({ changes, lastPulledAt }) => {
      const res = await fetch(`${API}/sync?last_pulled_at=${lastPulledAt}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ changes }),
      })
      if (!res.ok) throw new Error(`Push failed: ${res.status}`)
    },

    sendCreatedAsUpdated: true, // simpler server: treat created rows as upserts
  })
}
