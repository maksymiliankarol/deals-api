import { buyExpiryCutoff, indexBuy, toDbDate } from '../lib/buy'

const BATCH_SIZE = 20
// Give the original background indexing time to finish before retrying.
const GRACE_MS = 5 * 60 * 1000

export async function reindexMissing(env: CloudflareBindings) {
  const { results } = await env.deals_db
    .prepare(
      `SELECT id, description FROM buy
       WHERE indexed = 0 AND created_at >= ? AND created_at < ?
       ORDER BY id LIMIT ?`
    )
    .bind(buyExpiryCutoff(), toDbDate(new Date(Date.now() - GRACE_MS)), BATCH_SIZE)
    .all<{ id: number; description: string }>()

  for (const row of results) {
    await indexBuy(env, row.id, row.description)
  }

  if (results.length > 0) console.log(`reindex: tried ${results.length} listings`)
}