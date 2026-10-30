import type { InferOutput } from 'valibot'
import type { createBuy } from '../schemas'
import { indexDescription } from './vectorize'
import { embedText } from './embed'
import { priceCentsForTier } from './pricing'
import { ApiException } from './error-codes'

type BuyInput = InferOutput<typeof createBuy>

const BUY_TTL_MS = 72 * 60 * 60 * 1000
const TOP_K = 10
// Fetch extra candidates: some get filtered out (unlocked, held or expired).
const CANDIDATES = 30
// Cosine similarity floor. Leave at 0 until you've seen real scores, then tune.
const MIN_SCORE = 0

// D1's datetime('now') format: 'YYYY-MM-DD HH:MM:SS' in UTC.
export function toDbDate(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export function buyExpiryCutoff() {
  return toDbDate(new Date(Date.now() - BUY_TTL_MS))
}

type BuyRow = {
  id: number
  description: string
  tier: number
  created_at: string
}

export async function insertBuy(env: CloudflareBindings, input: BuyInput) {
  const { description, tier, email, phone } = input

  const row = await env.deals_db
    .prepare(
      'INSERT INTO buy (description, tier, email, phone) VALUES (?, ?, ?, ?) RETURNING id'
    )
    .bind(description, tier, email, phone)
    .first<{ id: number }>()

  if (!row) throw new ApiException(500, 'internal')

  return row.id
}

export async function indexBuy(env: CloudflareBindings, id: number, description: string) {
  const ok = await indexDescription(env.VECTORIZE_BUY, 'buy', id, description)
  if (!ok) return false

  try {
    await env.deals_db.prepare('UPDATE buy SET indexed = 1 WHERE id = ?').bind(id).run()
  } catch (err) {
    console.error(`Could not mark buy ${id} as indexed`, err)
    return false
  }
  return true
}

export async function findMatchingBuys(env: CloudflareBindings, description: string) {
  const vector = await embedText(description, 'query')
  const { matches } = await env.VECTORIZE_BUY.query(vector, { topK: CANDIDATES })

  const relevant = matches.filter((m) => m.score >= MIN_SCORE)
  if (relevant.length === 0) return []

  const ids = relevant.map((m) => Number(m.id))

  // Skip buys that are sold, currently held by a checkout, or expired but not
  // yet cleaned up.
  const { results } = await env.deals_db
    .prepare(
      `SELECT id, description, tier, created_at
       FROM buy
       WHERE id IN (${ids.map(() => '?').join(',')})
         AND (reserved_until IS NULL OR reserved_until < ?)
         AND created_at >= ?`
    )
    .bind(...ids, toDbDate(new Date()), buyExpiryCutoff())
    .all<BuyRow>()

  // D1 doesn't keep the IN-list order, so restore the score order from Vectorize.
  const rows = new Map(results.map((r) => [r.id, r]))

  return relevant
    .flatMap((m) => {
      const row = rows.get(Number(m.id))
      return row
        ? [{ ...row, price_cents: priceCentsForTier(row.tier), score: m.score }]
        : []
    })
    .slice(0, TOP_K)
}