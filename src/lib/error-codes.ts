import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

// Stable ids the client turns into text. Keep in sync with deals-web (src/lib/api.ts).
// The two signature codes are for Stripe's webhook calls: the browser never sees them.
export type ErrorCode =
  | 'invalid_input'
  | 'body_too_large'
  | 'rate_limited'
  | 'too_many_checkouts'
  | 'verification_required'
  | 'verification_failed'
  | 'verification_unavailable'
  | 'contact_info'
  | 'listing_unavailable'
  | 'checkout_failed'
  | 'session_not_found'
  | 'payment_unavailable'
  | 'payment_incomplete'
  | 'details_gone'
  | 'not_found'
  | 'internal'
  | 'missing_signature'
  | 'invalid_signature'

export type ErrorBody = { code: ErrorCode }

export const errorBody = (code: ErrorCode): ErrorBody => ({ code })

// Thrown from handlers and libs; onError in index.ts turns it into { code }
export class ApiException extends HTTPException {
  code: ErrorCode

  constructor(status: ContentfulStatusCode, code: ErrorCode) {
    super(status, { message: code })
    this.code = code
  }
}