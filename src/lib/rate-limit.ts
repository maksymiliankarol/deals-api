import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'
import { errorBody } from './error-codes'

type LimiterName = 'RL_BUY' | 'RL_SEARCH' | 'RL_UNLOCK' | 'RL_SESSION'

export const rateLimit = (name: LimiterName) =>
  createMiddleware<AppEnv>(async (c, next) => {
    // Set by Cloudflare itself on deployed Workers. Absent in `wrangler dev`,
    // where everyone shares one "unknown" bucket, which is fine locally.
    const key = c.req.header('cf-connecting-ip') ?? 'unknown'

    const { success } = await c.env[name].limit({ key })
    if (!success) {
      c.header('Retry-After', '60')
      return c.json(errorBody('rate_limited'), 429)
    }

    await next()
  })