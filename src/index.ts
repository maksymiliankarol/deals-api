import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from './types'
import buy from './routes/buy'
import search from './routes/search'
import unlock from './routes/unlock'
import stripeWebhook from './routes/stripe-webhook'
import { deleteExpiredDeals } from './jobs/cleanup'
import { reindexMissing } from './jobs/reindex'
import { ApiException, errorBody } from './lib/error-codes'

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

app.onError((err, c) => {
  if (err instanceof ApiException) return c.json(errorBody(err.code), err.status)

  // Thrown by Hono itself (for example malformed JSON in the validator):
  // never forward its message.
  if (err instanceof HTTPException) {
    return c.json(errorBody(err.status === 400 ? 'invalid_input' : 'internal'), err.status)
  }

  console.error('unhandled error', err) // shows up in observability
  return c.json(errorBody('internal'), 500)
})

app.notFound((c) => c.json(errorBody('not_found'), 404))

app.route('/api/buy', buy)
app.route('/api/search', search)
app.route('/api/unlock', unlock)
app.route('/api/stripe/webhook', stripeWebhook)

export default {
  fetch: app.fetch,
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(Promise.allSettled([deleteExpiredDeals(env), reindexMissing(env)]))
  }
} satisfies ExportedHandler<CloudflareBindings>