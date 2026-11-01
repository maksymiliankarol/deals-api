import { createGateway, embed } from "ai";

const MODEL = "cohere/embed-v5.0-pro";
export const EMBEDDING_DIMENSIONS = 1024;

export async function embedBuy(
  env: CloudflareBindings,
  text: string,
  inputType: "search_document" | "search_query" = "search_document",
): Promise<number[]> {
  const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY });

  const { embedding } = await embed({
    model: gateway.embeddingModel(MODEL),
    value: text,
    dimensions: EMBEDDING_DIMENSIONS,
    providerOptions: { cohere: { inputType } },
  });

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`
    );
  }

  return embedding;
}