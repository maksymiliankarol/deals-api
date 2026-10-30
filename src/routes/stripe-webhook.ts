import Stripe from 'stripe'
import { Hono } from 'hono'
import { getStripe } from '../lib/stripe'
import type { AppEnv } from '../types'
import { fulfillUnlock } from '../lib/unlock'
import { bodyLimit } from 'hono/body-limit'
import { ApiException } from '../lib/error-codes'

const stripeWebhook = new Hono<AppEnv>()

stripeWebhook.post('/', bodyLimit({ maxSize: 1024 * 1024 }), async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) throw new ApiException(400, 'missing_signature')

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
  throw new ApiException(400, 'invalid_signature') 
}

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object

    if (session.payment_status === 'paid') {
      await fulfillUnlock(c.env, session)
    }
  }

  // Everything else is acknowledged and ignored.
  return c.json({ received: true })
})

export default stripeWebhook