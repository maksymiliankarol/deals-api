import * as v from 'valibot'

// Kept on purpose: tab, newline, carriage return, and ZWNJ/ZWJ
// (emoji sequences and some scripts need them).
const KEEP = new Set(['\t', '\n', '\r', '\u200C', '\u200D'])

// Strips control and invisible formatting characters (zero-width spaces, bidi
// overrides, soft hyphens, BOM, Unicode "tag" characters used to hide text).
// Order matters: strip first, so characters that were separated by a hidden
// one can still compose under NFC.
//
// NFC, not NFKC: it only unifies equivalent encodings and never rewrites what
// the user typed (m², ½, ™ stay as they are). The contact check applies NFKC
// to its own copy.
const canonicalize = (text: string) =>
  text
    .replace(/[\p{Cc}\p{Cf}]/gu, (ch) => (KEEP.has(ch) ? ch : ''))
    .normalize('NFC')
    .trim()

// Everything downstream (contact check, AI check, DB, embeddings) gets this string.
const description = v.pipe(
  v.string(),
  v.transform(canonicalize),
  v.minLength(1),
  v.maxLength(500)
)
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

// Positive integer, no leading zeros, at most 15 digits (safe for Number).
// Before, a 400-digit string became Infinity and reached the database.
export const unlockParam = v.object({
  id: v.pipe(v.string(), v.regex(/^[1-9]\d{0,14}$/), v.transform(Number))
})


// The seller's local listing id, only used to send them back to that listing
// if they cancel the payment.
export const unlockBody = v.object({
  listingId: v.pipe(v.string(), v.uuid())
})

export const sessionParam = v.object({
  sessionId: v.pipe(v.string(), v.regex(/^cs_(test|live)_[A-Za-z0-9]{1,255}$/))
})