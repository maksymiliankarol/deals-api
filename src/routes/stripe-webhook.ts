import Stripe from 'stripe'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getStripe } from '../lib/stripe'
import { markBuyUnlocked } from '../lib/unlock'
import type { AppEnv } from '../types'

const stripeWebhook = new Hono<AppEnv>()

stripeWebhook.post('/', async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) throw new HTTPException(400, { message: 'Missing signature' })

  // Verification needs the exact raw body, so read text, not json.
  const body = await c.req.text()

  let event: Stripe.Event
  try {
    event = await getStripe(c.env).webhooks.constructEventAsync(
      body,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider()
    )
  } catch {
    throw new HTTPException(400, { message: 'Invalid signature' })
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object

    if (session.payment_status === 'paid') {
      const buyId = Number(session.metadata?.buy_id)

      if (Number.isInteger(buyId) && buyId > 0) {
        await markBuyUnlocked(c.env, buyId)
      } else {
        console.warn(`Paid session ${session.id} has no usable buy_id`)
      }
    }
  }

  // Everything else is acknowledged and ignored.
  return c.json({ received: true })
})

export default stripeWebhook