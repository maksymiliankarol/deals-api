import { buyExpiryCutoff, toDbDate } from '../lib/buy'
import { unlockedExpiryCutoff } from '../lib/unlock'
import { deleteVectors } from '../lib/vectorize'

const BATCH_SIZE = 100

export async function deleteExpiredDeals(env: CloudflareBindings) {
  // Fixed once per run so a row can't expire mid-run.
  const cutoff = buyExpiryCutoff()
  const now = toDbDate(new Date())

  while (true) {
    // Skip rows with a live checkout: it may still be paid, and fulfilment needs the row.
    const { results } = await env.deals_db
      .prepare(
        `SELECT id FROM buy
         WHERE created_at < ? AND (reserved_until IS NULL OR reserved_until < ?)
         LIMIT ?`
      )
      .bind(cutoff, now, BATCH_SIZE)
      .all<{ id: number }>()

    if (results.length === 0) break

    const ids = results.map((r) => r.id)

    await deleteVectors(env.VECTORIZE_BUY, ids)
    await env.deals_db
      .prepare(`DELETE FROM buy WHERE id IN (${ids.map(() => '?').join(',')})`)
      .bind(...ids)
      .run()
  }

  await env.deals_db
    .prepare('DELETE FROM unlocked WHERE created_at < ?')
    .bind(unlockedExpiryCutoff())
    .run()
}