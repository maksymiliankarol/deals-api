import { Hono } from 'hono'
import { vValidator } from '@hono/valibot-validator'
import { unlockParam, unlockBody, sessionParam } from '../schemas'
import { createUnlockCheckout, getUnlockedDetails } from '../lib/unlock'
import { rateLimit } from '../lib/rate-limit'
import { turnstile } from '../lib/turnstile'
import type { AppEnv } from '../types'
import { jsonBodyLimit } from '../lib/body-limit'

const unlock = new Hono<AppEnv>()

unlock.post(
  '/:id',
  rateLimit('RL_UNLOCK'),
  jsonBodyLimit,
  turnstile,
  vValidator('param', unlockParam),
  vValidator('json', unlockBody),
  async (c) => {
    const { id } = c.req.valid('param')
    const { listingId } = c.req.valid('json')

    const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
    const url = await createUnlockCheckout(c.env, id, listingId, ip)

    return c.json({ url })
  }
)

unlock.get('/session/:sessionId', rateLimit('RL_SESSION'), vValidator('param', sessionParam), async (c) => {
  const { sessionId } = c.req.valid('param')

  const details = await getUnlockedDetails(c.env, sessionId)

  // Contains contact details: never let a cache keep it.
  c.header('Cache-Control', 'no-store')

  return c.json(details)
})

export default unlock