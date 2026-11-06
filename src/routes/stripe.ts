import { Hono } from "hono";
import type Stripe from "stripe";
import { getStripe } from "../lib/stripe";

const stripe = new Hono<{ Bindings: CloudflareBindings }>();

stripe.post("/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) return c.json({ error: "Missing signature" }, 400);

  // The signature is checked against the raw body, so read it as text
  let event: Stripe.Event;
  try {
    event = await getStripe(c.env).webhooks.constructEventAsync(
      await c.req.text(),
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await finalize(c.env, event.data.object);
  }

  return c.json({ received: true });
});

async function finalize(env: CloudflareBindings, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;

  const id = Number(session.client_reference_id);
  if (!Number.isInteger(id)) return;

  // Move the row atomically. The listing must still be held by THIS session.
  // On a Stripe retry the row is already gone, so both statements do nothing.
  const [insert] = await env.DB.batch([
    env.DB
      .prepare(
        `INSERT INTO unlocked (id, stripe_session_id, description, email, phone, price, currency, listed_at)
         SELECT id, ?, description, email, phone, ?, ?, created_at
         FROM buy WHERE id = ? AND stripe_session_id = ?`
      )
      .bind(session.id, session.amount_total, session.currency, id, session.id),
    env.DB
      .prepare("DELETE FROM buy WHERE id = ? AND stripe_session_id = ?")
      .bind(id, session.id),
  ]);

  if (insert.meta.changes === 0) {
    const done = await env.DB
      .prepare("SELECT 1 FROM unlocked WHERE stripe_session_id = ?")
      .bind(session.id)
      .first();
    if (!done) console.error(`Paid session ${session.id} but listing ${id} is gone: refund needed`);
    return;
  }

  // Best effort: a leftover vector is harmless because /search reads rows from D1
  try {
    await env.VECTORIZE.deleteByIds([String(id)]);
  } catch (e) {
    console.error("Vectorize cleanup failed", e);
  }
}

export default stripe;