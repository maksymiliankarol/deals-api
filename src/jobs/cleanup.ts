const BUY_MAX_AGE = "-72 hours";
const UNLOCKED_MAX_AGE = "-14 days"; // short-term backup; Stripe is the bookkeeping record

export async function cleanup(env: CloudflareBindings) {
  // 1. Old listings, but never one that is being paid for right now
  const { results } = await env.DB
    .prepare(
      `DELETE FROM buy
       WHERE created_at < datetime('now', ?)
         AND (reserved_until IS NULL OR reserved_until < datetime('now'))
       RETURNING id`
    )
    .bind(BUY_MAX_AGE)
    .all<{ id: number }>();

  // 2. Remove their vectors, in chunks. Best effort: /search reads rows from D1,
  //    so a leftover vector is harmless (it only takes up a slot in the top 25)
  const ids = results.map((r) => String(r.id));
  for (let i = 0; i < ids.length; i += 100) {
    try {
      await env.VECTORIZE.deleteByIds(ids.slice(i, i + 100));
    } catch (e) {
      console.error("Vectorize cleanup failed", e);
    }
  }

  // 3. Old unlocked rows
  await env.DB
    .prepare("DELETE FROM unlocked WHERE unlocked_at < datetime('now', ?)")
    .bind(UNLOCKED_MAX_AGE)
    .run();
}