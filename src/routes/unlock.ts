import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import { getStripe } from "../lib/stripe";
import { UNLOCK_PRICE } from "../lib/pricing";
import { IdParamSchema, SessionParamSchema } from "../schema";

// Stripe sessions live at least 30 min, so hold the listing a bit longer.
const SESSION_MINUTES = 30;
const RESERVE_MINUTES = 35;

const unlock = new Hono<{ Bindings: CloudflareBindings }>();

unlock.post("/:id", vValidator("param", IdParamSchema), async (c) => {
  const { id } = c.req.valid("param");

  // 1. Reserve atomically: only works if the listing is free or its old hold expired
  const reserved = await c.env.DB
    .prepare(
      `UPDATE buy
      SET reserved_until = datetime('now', '+${RESERVE_MINUTES} minutes'),
          stripe_session_id = NULL
      WHERE id = ? AND (reserved_until IS NULL OR reserved_until < datetime('now'))
      RETURNING id`
    )
    .bind(id)
    .first();

  if (!reserved) return c.json({ error: "Listing not available" }, 409);

  // 2. Create the checkout session; release the hold if anything fails
  try {
    const session = await getStripe(c.env).checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: UNLOCK_PRICE.currency,
            unit_amount: UNLOCK_PRICE.amount,
            product_data: { name: "Buyer contact details" },
          },
          quantity: 1,
        },
      ],      
      client_reference_id: String(id),
      expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
      success_url: `${c.env.WEB_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${c.env.WEB_URL}/sell`,
    });

    await c.env.DB
      .prepare("UPDATE buy SET stripe_session_id = ? WHERE id = ?")
      .bind(session.id, id)
      .run();

    return c.json({ url: session.url, sessionId: session.id }, 201);
  } catch (e) {
    await c.env.DB
      .prepare("UPDATE buy SET reserved_until = NULL, stripe_session_id = NULL WHERE id = ?")
      .bind(id)
      .run();
    throw e;
  }
});

unlock.get("/:sessionId", vValidator("param", SessionParamSchema), async (c) => {
  const { sessionId } = c.req.valid("param");

  // Contact details must never be cached by the browser or a proxy
  c.header("Cache-Control", "no-store");

  // 1. Claim the reveal atomically: only the first request gets a row back
  const row = await c.env.DB
    .prepare(
      `UPDATE unlocked
       SET revealed_at = CURRENT_TIMESTAMP
       WHERE stripe_session_id = ? AND revealed_at IS NULL
       RETURNING id, description, email, phone, price, currency, listed_at, unlocked_at`
    )
    .bind(sessionId)
    .first();

  if (row) return c.json(row);

  // 2. Not claimed: was it already revealed?
  const revealed = await c.env.DB
    .prepare("SELECT 1 FROM unlocked WHERE stripe_session_id = ?")
    .bind(sessionId)
    .first();

  if (revealed) return c.json({ error: "Already revealed" }, 410);

  // 3. Paid, but the webhook hasn't moved the row yet: tell the client to retry
  const pending = await c.env.DB
    .prepare(
      `SELECT 1 FROM buy
       WHERE stripe_session_id = ? AND reserved_until > datetime('now')`
    )
    .bind(sessionId)
    .first();

  if (pending) return c.json({ status: "pending" }, 202);

  return c.json({ error: "Not found" }, 404);
});

export default unlock;