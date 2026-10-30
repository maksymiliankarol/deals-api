import { Hono } from 'hono'
import { vValidator } from '@hono/valibot-validator'
import { findMatchingBuys } from '../lib/buy'
import { rateLimit } from '../lib/rate-limit'
import type { AppEnv } from '../types'
import { searchBuys } from '../schemas'
import { jsonBodyLimit } from '../lib/body-limit'
import { turnstile } from '../lib/turnstile'
import { invalidInput } from '../lib/validation-hook'

const search = new Hono<AppEnv>()

search.post('/', rateLimit('RL_SEARCH'), jsonBodyLimit, turnstile, vValidator('json', searchBuys, invalidInput), async (c) => {
  const { description } = c.req.valid('json')

  const matches = await findMatchingBuys(c.env, description)

  return c.json({ matches })
})

export default search