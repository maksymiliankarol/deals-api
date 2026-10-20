import Stripe from 'stripe'

export function getStripe(env: CloudflareBindings) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    // Workers has no Node http module, so use fetch.
    httpClient: Stripe.createFetchHttpClient()
  })
}