import { Hono } from 'hono'
import { vValidator } from '@hono/valibot-validator'
import { createBuy } from '../schemas'
import { insertBuy, indexBuy } from '../lib/buy'
import { findContactInfo } from '../lib/contact-check'
import { findContactInfoWithAI } from '../lib/contact-ai-check'
import { rateLimit } from '../lib/rate-limit'
import { turnstile } from '../lib/turnstile'
import type { AppEnv } from '../types'
import { jsonBodyLimit } from '../lib/body-limit'
import { invalidInput } from '../lib/validation-hook'
import { errorBody } from '../lib/error-codes'

const buy = new Hono<AppEnv>()

buy.post('/', rateLimit('RL_BUY'), jsonBodyLimit, turnstile, vValidator('json', createBuy, invalidInput), async (c) => {
  const input = c.req.valid('json')

  const ruleReason = findContactInfo(input.description)
  const aiReason = ruleReason
    ? null
    : await findContactInfoWithAI(c.env, input.description)

  if (ruleReason || aiReason) {
    console.log('buy rejected by contact check', { ruleReason, aiReason })
    return c.json(errorBody('contact_info'), 422)
  }

  const id = await insertBuy(c.env, input)
  c.executionCtx.waitUntil(indexBuy(c.env, id, input.description))

  return c.json({ id }, 201)
})

export default buy