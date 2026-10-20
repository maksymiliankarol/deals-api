import { embedText } from './embed'

type VectorIndex = CloudflareBindings['VECTORIZE_BUY']

export function upsertVector(index: VectorIndex, id: number, values: number[]) {
  return index.upsert([{ id: String(id), values }])
}

export function deleteVectors(index: VectorIndex, ids: number[]) {
  return index.deleteByIds(ids.map(String))
}

export async function indexDescription(
  index: VectorIndex,
  label: string,
  id: number,
  description: string
) {
  try {
    const values = await embedText(description, 'document')
    await upsertVector(index, id, values)
  } catch (err) {
    console.error(`Indexing failed for ${label} ${id}`, err)
  }
}