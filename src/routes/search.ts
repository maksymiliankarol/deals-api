import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import { SearchSchema } from "../schema";
import { BuyRow } from "../types";
import { embedBuy } from "../lib/embed-buy";
import { rerankBuy } from "../lib/rerank-buy";

const search = new Hono<{ Bindings: CloudflareBindings }>();

search.get("/", vValidator("query", SearchSchema), async (c) => {
  const { q } = c.req.valid("query");

  // 1. Recall: wide net from Vectorize
  const embedding = await embedBuy(c.env, q, "search_query");
  const { matches } = await c.env.VECTORIZE.query(embedding, { topK: 25 });
  if (matches.length === 0) return c.json([]);

  // 2. Load the candidates from D1
  const ids = matches.map((m) => Number(m.id));
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await c.env.DB
    .prepare(
      `SELECT id, description, created_at FROM buy WHERE id IN (${placeholders})`
    )
    .bind(...ids)
    .all<BuyRow>();

  // 3. Precision: rerank and keep the best 5
  const ranked = await rerankBuy(c.env, q, results, 5);

  return c.json(
    ranked.map(({ id, description, created_at, rerankScore }) => ({
      id,
      description,
      created_at,
      score: rerankScore,
    }))
  );
});

export default search;