import { Hono } from 'hono'
import { cors } from 'hono/cors'
import buy from './routes/buy'
import { deleteExpiredDeals } from './jobs/cleanup'
import type { AppEnv } from './types'
import search from './routes/search'
import unlock from './routes/unlock'
import stripeWebhook from './routes/stripe-webhook'

const app = new Hono<AppEnv>()

// The allowed origin comes from the environment (localhost in dev, the real site in prod).
app.use('/api/*', (c, next) =>
  cors({
    // .origin drops any path or trailing slash, which would never match a browser's Origin header.
    origin: new URL(c.env.WEB_URL).origin,
    // Every JSON POST is preflighted; let browsers cache the answer.
    maxAge: 86400
  })(c, next)
)
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