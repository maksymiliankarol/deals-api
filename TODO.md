- AI check. This is the second layer for what regex misses, like “five five five, one two three...” or “find me on insta, it’s my name plus 88”. It costs money and adds latency, so it only runs on descriptions that passed the regex. Maybe @clef family model with cf.

- Cap on open reservations per IP. buy has no IP column yet, so it needs a small migration and a check in POST /unlock/:id.

- Cron cleanup of old listings. This is a scheduled handler in wrangler.jsonc that deletes rows older than your limit (72h?) from D1 and their vectors from Vectorize.

- Automatic refunds. This is the biggest item: Stripe refund calls, plus a decision about when to refund (the “paid but listing gone” case).