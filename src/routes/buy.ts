import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { BuySchema } from "../schema";
import { embedBuy } from "../lib/embed-buy";
import { hasContactDetails } from "../lib/contact-check";

const buy = new Hono<{ Bindings: CloudflareBindings }>();

buy.post("/", vValidator("json", BuySchema), async (c) => {
  const { description, email, phone } = c.req.valid("json");

  if (hasContactDetails(description)) {
    return c.json({ error: "Remove contact details (email, phone, links) from the description" }, 400);
  }

  // Embed first, so a gateway failure doesn't leave an orphan row
  const embedding = await embedBuy(c.env, description);

  const { id } = (await c.env.DB
    .prepare("INSERT INTO buy (description, email, phone) VALUES (?, ?, ?) RETURNING id")
    .bind(description, email, phone)
    .first<{ id: number }>())!;

  try {
    await c.env.VECTORIZE.upsert([{ id: String(id), values: embedding }]);
  } catch (e) {
    await c.env.DB.prepare("DELETE FROM buy WHERE id = ?").bind(id).run();
    throw e;
  }

  return c.json({ id }, 201);
});

export default buy;