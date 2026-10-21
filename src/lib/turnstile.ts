import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type SiteverifyResponse = {
  success: boolean
  'error-codes'?: string[]
}

export const turnstile = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.req.header('x-turnstile-token')
  if (!token) return c.json({ error: 'Please complete the verification' }, 403)

  const body = new URLSearchParams({
    secret: c.env.TURNSTILE_SECRET_KEY,
    response: token
  })
  const ip = c.req.header('cf-connecting-ip')
  if (ip) body.set('remoteip', ip)

  let result: SiteverifyResponse
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) throw new Error(`siteverify returned ${res.status}`)
    result = (await res.json()) as SiteverifyResponse
  } catch (err) {
    // Fail closed: with no verdict, nothing gets through.
    console.error('turnstile siteverify failed', err)
    return c.json({ error: 'Verification is unavailable. Please try again.' }, 503)
  }

  if (!result.success) {
    console.log('turnstile rejected', { codes: result['error-codes'] })
    return c.json({ error: 'Verification failed. Please try again.' }, 403)
  }

  await next()
})