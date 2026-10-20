import * as v from 'valibot'

const description = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500))
const email = v.pipe(v.string(), v.trim(), v.email(), v.maxLength(254))
const phone = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\+?[0-9 ()-]{7,20}$/, 'Invalid phone number')
)

export const createBuy = v.object({
  description,
  tier: v.optional(v.picklist([0, 1, 2, 3]), 1),
  email,
  phone,
})

export const searchBuys = v.object({
  description
})

export const unlockParam = v.object({
  id: v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number))
})

// The seller's local listing id, only used to send them back to that listing
// if they cancel the payment.
export const unlockBody = v.object({
  listingId: v.pipe(v.string(), v.uuid())
})

export const sessionParam = v.object({
  sessionId: v.pipe(v.string(), v.regex(/^cs_(test|live)_[A-Za-z0-9]+$/))
})