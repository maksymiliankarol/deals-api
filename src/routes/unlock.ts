import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import { getStripe } from "../lib/stripe";
import { UNLOCK_PRICE } from "../lib/pricing";
import { IdParamSchema, SessionParamSchema } from "../schema";

// Stripe wants a session to live at least 30 min, so keep a margin.
// The listing is held a bit longer than the session.
const SESSION_MINUTES = 31;
const RESERVE_MINUTES = 35;
const MAX_OPEN_RESERVATIONS = 3; // open holds one IP may have at the same time

const unlock = new Hono<{ Bindings: CloudflareBindings }>();

unlock.post("/:id", vValidator("param", IdParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const isCli = c.req.query("client") === "cli";
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";

  // 1. Reserve atomically: the listing must be free (or its old hold expired)
  //    and this IP must have fewer than MAX_OPEN_RESERVATIONS open holds
  const reserved = await c.env.DB
    .prepare(
      `UPDATE buy
       SET reserved_until = datetime('now', ?4), stripe_session_id = NULL, reserved_by = ?1
       WHERE id = ?2
         AND (reserved_until IS NULL OR reserved_until < datetime('now'))
         AND (SELECT COUNT(*) FROM buy
              WHERE reserved_by = ?1 AND reserved_until > datetime('now')) < ?3
       RETURNING id`
    )
    .bind(ip, id, MAX_OPEN_RESERVATIONS, `+${RESERVE_MINUTES} minutes`)
    .first();

  if (!reserved) {
    // Either this IP is at its cap, or the listing is taken
    const { n } = (await c.env.DB
      .prepare("SELECT COUNT(*) AS n FROM buy WHERE reserved_by = ? AND reserved_until > datetime('now')")
      .bind(ip)
      .first<{ n: number }>())!;

    if (n >= MAX_OPEN_RESERVATIONS) {
      return c.json({ error: "Too many open reservations. Pay for one or wait for it to expire." }, 429);
    }
    return c.json({ error: "Listing not available" }, 409);
  }

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
      success_url: isCli
        ? `${c.env.WEB_URL}/cli-success`
        : `${c.env.WEB_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: isCli ? `${c.env.WEB_URL}/cli-success?cancelled=1` : `${c.env.WEB_URL}/sell`,
    });

    await c.env.DB
      .prepare("UPDATE buy SET stripe_session_id = ? WHERE id = ?")
      .bind(session.id, id)
      .run();

    return c.json({ url: session.url, sessionId: session.id }, 201);
  } catch (e) {
    await c.env.DB
      .prepare("UPDATE buy SET reserved_until = NULL, stripe_session_id = NULL, reserved_by = NULL WHERE id = ?")
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
    .prepare("SELECT 1 FROM buy WHERE stripe_session_id = ? AND reserved_until > datetime('now')")
    .bind(sessionId)
    .first();
  if (pending) return c.json({ status: "pending" }, 202);

  return c.json({ error: "Not found" }, 404);
});

export default unlock;