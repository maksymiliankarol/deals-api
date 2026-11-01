import { createGateway, rerank } from "ai";

const MODEL = "cohere/rerank-v5-pro";

export async function rerankBuy<T extends { description: string }>(
  env: CloudflareBindings,
  query: string,
  items: T[],
  topN = 5,
): Promise<(T & { rerankScore: number })[]> {
  if (items.length === 0) return [];

  const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY });

  const { ranking } = await rerank({
    model: gateway.rerankingModel(MODEL),
    query,
    documents: items.map((i) => i.description),
    topN,
  });

  return ranking.map((r) => ({
    ...items[r.originalIndex],
    rerankScore: r.score,
  }));
}