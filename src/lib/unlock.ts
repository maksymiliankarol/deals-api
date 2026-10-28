import { HTTPException } from 'hono/http-exception'
import Stripe from 'stripe'
import { buyExpiryCutoff, toDbDate } from './buy'
import { priceCentsForTier } from './pricing'
import { getStripe } from './stripe'
import { deleteVectors } from './vectorize'

const MINUTE_MS = 60 * 1000
// Stripe requires a session to live at least 30 minutes. The hold outlasts the
// session, so a buy is never released while its checkout can still be paid.
const UNLOCKED_TTL_MS = 24 * 60 * MINUTE_MS
const SESSION_MINUTES = 31
const HOLD_MINUTES = 33
const MAX_HOLDS_PER_IP = 2

export type UnlockedDetails = {
  description: string
  tier: number
  email: string
  phone: string
  price_cents: number
  purchased_at: string
}

export async function createUnlockCheckout(
  env: CloudflareBindings,
  id: number,
  listingId: string,
  ip: string
) {
  const now = Date.now()

  const holds = await env.deals_db
    .prepare('SELECT COUNT(*) AS n FROM buy WHERE reserved_by = ? AND reserved_until >= ?')
    .bind(ip, toDbDate(new Date(now)))
    .first<{ n: number }>()
  if ((holds?.n ?? 0) >= MAX_HOLDS_PER_IP) {
    throw new HTTPException(429, { message: 'You already have open checkouts. Finish or wait for them first.' })
  }

  // Claim the buy and read it in one atomic statement: only one caller can win.
  const buy = await env.deals_db
    .prepare(
      `UPDATE buy SET reserved_until = ?, reserved_by = ?
      WHERE id = ?
        AND (reserved_until IS NULL OR reserved_until < ?)
        AND created_at >= ?
      RETURNING tier`
    )
    .bind(
      toDbDate(new Date(now + HOLD_MINUTES * MINUTE_MS)),
      ip,
      id,
      toDbDate(new Date(now)),
      buyExpiryCutoff()
    )
    .first<{ tier: number }>()

  if (!buy) {
    throw new HTTPException(409, { message: 'This listing is no longer available' })
  }

  try {
    const session = await getStripe(env).checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            // Priced from the stored tier, never from anything the client sends.
            unit_amount: priceCentsForTier(buy.tier),
            product_data: { name: 'Unlock contact details' }
          }
        }
      ],
      expires_at: Math.floor(now / 1000) + SESSION_MINUTES * 60,
      success_url: `${env.WEB_URL}/unlock/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.WEB_URL}/my-listings/${listingId}`,
      // The success page reads these back from Stripe after the buy is gone.
      metadata: { buy_id: String(id) }
    })

    if (!session.url) throw new Error('Stripe returned no checkout URL')

    return session.url
  } catch (err) {
    console.error(`Checkout failed for buy ${id}`, err)

    // Give the buy back right away instead of holding it for nothing.
    await env.deals_db
      .prepare('UPDATE buy SET reserved_until = NULL, reserved_by = NULL WHERE id = ?')
      .bind(id)
      .run()

    throw new HTTPException(502, { message: 'Could not start checkout' })
  }
}

// Moves a paid buy into `unlocked`. Safe to call any number of times, from the
// webhook and from the success page: later calls find nothing left to move.
export async function fulfillUnlock(env: CloudflareBindings, session: Stripe.Checkout.Session) {
  const buyId = Number(session.metadata?.buy_id)
  if (!Number.isInteger(buyId) || buyId <= 0) {
    console.warn(`Paid session ${session.id} has no usable buy_id`)
    return
  }

  // One transaction: the details are never in both tables, or in neither.
  const [insert] = await env.deals_db.batch([
    env.deals_db
      .prepare(
        `INSERT OR IGNORE INTO unlocked
           (session_id, description, tier, email, phone, price_cents, purchased_at)
         SELECT ?, description, tier, email, phone, ?, ? FROM buy WHERE id = ?`
      )
      .bind(
        session.id,
        session.amount_total ?? 0,
        new Date(session.created * 1000).toISOString(),
        buyId
      ),
    env.deals_db.prepare('DELETE FROM buy WHERE id = ?').bind(buyId)
  ])

  // Only the call that did the move cleans up. Best effort: search skips ids with no row anyway.
  if (insert.meta.changes > 0) {
    try {
      await deleteVectors(env.VECTORIZE_BUY, [buyId])
    } catch (err) {
      console.error(`Could not delete vector for buy ${buyId}`, err)
    }
  }
}

export async function getUnlockedDetails(
  env: CloudflareBindings,
  sessionId: string
): Promise<UnlockedDetails> {
  let session: Stripe.Checkout.Session

  try {
    session = await getStripe(env).checkout.sessions.retrieve(sessionId)
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      // An id that looks right but Stripe doesn't know.
      throw new HTTPException(404, { message: 'Checkout session not found' })
    }
    console.error(`Could not retrieve session ${sessionId}`, err)
    throw new HTTPException(502, { message: 'Could not reach the payment provider' })
  }

  if (session.payment_status !== 'paid') {
    throw new HTTPException(402, { message: 'Payment not completed' })
  }

  // in getUnlockedDetails, after the payment_status check:
  if (!session.metadata?.buy_id) {
    throw new HTTPException(404, { message: 'Checkout session not found' })
  }

  await fulfillUnlock(env, session)

  const row = await env.deals_db
    .prepare(
      `SELECT description, tier, email, phone, price_cents, purchased_at
      FROM unlocked WHERE session_id = ?`
    )
    .bind(session.id)
    .first<UnlockedDetails>()

  if (!row) {
    // Paid recently but nothing to hand over: the buy was gone before we could move it.
    if (Date.now() - session.created * 1000 < UNLOCKED_TTL_MS) {
      console.error(`Paid session ${session.id} has no details to deliver`)
    }
    throw new HTTPException(410, { message: 'These details are no longer available' })
  }

  return row
}

export function unlockedExpiryCutoff() {
  return toDbDate(new Date(Date.now() - UNLOCKED_TTL_MS))
}