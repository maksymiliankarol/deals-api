// Price in US cents by buy tier (index = tier)
const TIER_PRICE_CENTS = [4900, 9900, 19900, 29900]

export function priceCentsForTier(tier: number): number {
  const price = TIER_PRICE_CENTS[tier]
  if (price === undefined) throw new Error(`No price for tier ${tier}`)
  return price
}