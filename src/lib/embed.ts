import { embed } from 'ai'

export type EmbedRole = 'document' | 'query'

const INPUT_TYPE = {
  document: 'search_document',
  query: 'search_query'
} as const

export async function embedText(value: string, role: EmbedRole): Promise<number[]> {
  const { embedding } = await embed({
    model: 'cohere/embed-v5.0-pro',
    value,
    dimensions: 1536,
    providerOptions: { cohere: { inputType: INPUT_TYPE[role] } }
  })

  return embedding
}