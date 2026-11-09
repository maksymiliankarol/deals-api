import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { BuySchema } from "../schema";
import { embedBuy } from "../lib/embed-buy";
import { hasContactDetails } from "../lib/contact-check";

const buy = new Hono<{ Bindings: CloudflareBindings }>();

buy.post("/", vValidator("json", BuySchema), async (c) => {
  const { description, email, phone } = c.req.valid("json");

  // Version with check for hidden contact, but need we need no request limit model
  //
  // Regex first (free); the AI check only runs if the regex passed
  //if (hasContactDetails(description) || (await hasHiddenContact(c.env, description))) {
  //  return c.json(
  //    { error: "Remove contact details (email, phone, links) from the description", code: "contact_details" },
  //    400,
  //  );
  //}

  // Regex only for now. The AI check lives in lib/ai-contact-check.ts but is not called.
  if (hasContactDetails(description)) {
    return c.json(
      { error: "Remove contact details (email, phone, links) from the description", code: "contact_details" },
      400,
    );
  }


  // 1. Embed first, so a gateway failure doesn't leave an orphan row
  const embedding = await embedBuy(c.env, description);

  // 2. Save to D1
  const row = await c.env.DB
    .prepare("INSERT INTO buy (description, email, phone) VALUES (?, ?, ?) RETURNING id, description, email, phone, created_at")
    .bind(description, email, phone)
    .first<{ id: number }>();

  // 3. Store the vectorize under the same id
  try {
    await c.env.VECTORIZE.upsert([{ id: String(row!.id), values: embedding }]);
  } catch (e) {
    await c.env.DB.prepare("DELETE FROM buy WHERE id = ?").bind(row!.id).run();
    throw e;
  }

  return c.json(row, 201);
});

export default buy;