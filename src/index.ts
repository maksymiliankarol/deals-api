import { Hono } from 'hono'
import { cors } from 'hono/cors'
import buy from './routes/buy'
import { deleteExpiredDeals } from './jobs/cleanup'
import type { AppEnv } from './types'
import search from './routes/search'
import unlock from './routes/unlock'
import stripeWebhook from './routes/stripe-webhook'

const app = new Hono<AppEnv>()

app.use('/api/*', cors())
app.route('/api/buy', buy)
app.route('/api/search', search)
app.route('/api/unlock', unlock)
app.route('/api/stripe/webhook', stripeWebhook)

export default {
  fetch: app.fetch,
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(deleteExpiredDeals(env))
  }
} satisfies ExportedHandler<CloudflareBindings>