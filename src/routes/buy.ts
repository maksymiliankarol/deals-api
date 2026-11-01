import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { BuySchema } from "../schema";
import { embedBuy } from "../lib/embed-buy";

const buy = new Hono<{ Bindings: CloudflareBindings }>();

buy.post("/", vValidator("json", BuySchema), async (c) => {
  const { description, email, phone } = c.req.valid("json");

  // 1. Embed first, so a gateway failure doesn't leave an orphan row
  const embedding = await embedBuy(c.env, description);

  // 2. Save to D1
  const row = await c.env.DB
    .prepare("INSERT INTO buy (description, email, phone) VALUES (?, ?, ?) RETURNING id, description, email, phone, created_at")
    .bind(description, email, phone)
    .first<{ id: number }>();

  // 3. Store the vectorize under the same id
  await c.env.VECTORIZE.upsert([{ 
    id: String(row!.id), 
    values: embedding 
  }]);

  return c.json(row, 201);
});

export default buy;