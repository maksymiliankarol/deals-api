import { Hono } from 'hono'
import { vValidator } from '@hono/valibot-validator'
import { findMatchingBuys } from '../lib/buy'
import type { AppEnv } from '../types'
import { searchBuys } from '../schemas'

const search = new Hono<AppEnv>()

search.post('/', vValidator('json', searchBuys), async (c) => {
  const { description } = c.req.valid('json')

  const matches = await findMatchingBuys(c.env, description)

  return c.json({ matches })
})

export default search