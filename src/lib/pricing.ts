// Price in US cents by buy tier (index = tier). Placeholder prices.
const TIER_PRICE_CENTS = [1000, 2000, 3000, 4000]

export function priceCentsForTier(tier: number): number {
  const price = TIER_PRICE_CENTS[tier]
  if (price === undefined) throw new Error(`No price for tier ${tier}`)
  return price
}