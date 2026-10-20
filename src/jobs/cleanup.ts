import { buyExpiryCutoff } from '../lib/buy'
import { deleteVectors } from '../lib/vectorize'

const BATCH_SIZE = 100

export async function deleteExpiredDeals(env: CloudflareBindings) {
  // Fixed once per run so a row can't expire mid-run.
  const cutoff = buyExpiryCutoff()

  while (true) {
    const { results } = await env.deals_db
      .prepare('SELECT id FROM buy WHERE is_unlocked = 1 OR created_at < ? LIMIT ?')
      .bind(cutoff, BATCH_SIZE)
      .all<{ id: number }>()

    if (results.length === 0) break

    const ids = results.map((r) => r.id)

    await deleteVectors(env.VECTORIZE_BUY, ids)
    await env.deals_db
      .prepare(`DELETE FROM buy WHERE id IN (${ids.map(() => '?').join(',')})`)
      .bind(...ids)
      .run()
  }
}