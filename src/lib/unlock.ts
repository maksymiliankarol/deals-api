import { HTTPException } from 'hono/http-exception'
import Stripe from 'stripe'
import { buyExpiryCutoff, toDbDate } from './buy'
import { priceCentsForTier } from './pricing'
import { getStripe } from './stripe'

const MINUTE_MS = 60 * 1000
// Stripe requires a session to live at least 30 minutes. The hold outlasts the
// session, so a buy is never released while its checkout can still be paid.
const SESSION_MINUTES = 31
const HOLD_MINUTES = 33

type ClaimedBuy = {
  description: string
  tier: number
  email: string
  phone: string
}

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
  listingId: string
) {
  const now = Date.now()

  // Claim the buy and read it in one atomic statement: only one caller can win.
  const buy = await env.deals_db
    .prepare(
      `UPDATE buy SET reserved_until = ?
       WHERE id = ?
         AND is_unlocked = 0
         AND (reserved_until IS NULL OR reserved_until < ?)
         AND created_at >= ?
       RETURNING description, tier, email, phone`
    )
    .bind(
      toDbDate(new Date(now + HOLD_MINUTES * MINUTE_MS)),
      id,
      toDbDate(new Date(now)),
      buyExpiryCutoff()
    )
    .first<ClaimedBuy>()

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
      metadata: {
        buy_id: String(id),
        tier: String(buy.tier),
        description: buy.description,
        email: buy.email,
        phone: buy.phone
      }
    })

    if (!session.url) throw new Error('Stripe returned no checkout URL')

    return session.url
  } catch (err) {
    console.error(`Checkout failed for buy ${id}`, err)

    // Give the buy back right away instead of holding it for nothing.
    await env.deals_db
      .prepare('UPDATE buy SET reserved_until = NULL WHERE id = ?')
      .bind(id)
      .run()

    throw new HTTPException(502, { message: 'Could not start checkout' })
  }
}

export async function markBuyUnlocked(env: CloudflareBindings, buyId: number) {
  // Idempotent: Stripe can deliver the same event more than once.
  await env.deals_db
    .prepare('UPDATE buy SET is_unlocked = 1, reserved_until = NULL WHERE id = ?')
    .bind(buyId)
    .run()
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

  // Sessions that didn't come from createUnlockCheckout have no metadata like this.
  const { description, email, phone, tier } = session.metadata ?? {}
  if (!description || !email || !phone || tier === undefined) {
    throw new HTTPException(404, { message: 'Checkout session not found' })
  }

  return {
    description,
    tier: Number(tier),
    email,
    phone,
    price_cents: session.amount_total ?? 0,
    // Session creation time: within minutes of payment, good enough for a receipt.
    purchased_at: new Date(session.created * 1000).toISOString()
  }
}