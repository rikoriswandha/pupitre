import { jsonFetch, t } from '@rikology/pupitre-react'
export type MediaItem = { id: number; filename: string; alt: string; mime: string; url: string }
export async function mediaRows(input: string | Response): Promise<MediaItem[]> {
  const response = typeof input === 'string' ? await jsonFetch(input) : input
  if (!response.ok) throw new Error(t('Media request failed'))
  const payload: unknown = await response.json()
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('rows' in payload) ||
    !Array.isArray(payload.rows)
  )
    throw new Error(t('Media request failed'))
  return payload.rows.map((row: unknown) => {
    if (
      !row ||
      typeof row !== 'object' ||
      !('id' in row) ||
      typeof row.id !== 'number' ||
      !('filename' in row) ||
      typeof row.filename !== 'string' ||
      !('alt' in row) ||
      typeof row.alt !== 'string' ||
      !('mime' in row) ||
      typeof row.mime !== 'string' ||
      !('url' in row) ||
      typeof row.url !== 'string'
    )
      throw new Error(t('Media request failed'))
    return { id: row.id, filename: row.filename, alt: row.alt, mime: row.mime, url: row.url }
  })
}

/** Stay within Adonis' default qs arrayLimit for indexed query parameters. */
const MAX_IDS = 20
type MediaBatchResult = { found: Map<number, MediaItem>; failed: Set<number> }
type MediaBatch = { ids: Set<number>; promise: Promise<MediaBatchResult> }
const batches = new Map<string, MediaBatch>()

/**
 * Coalesces thumbnail lookups issued in the same tick (e.g. one per table row) into
 * chunked browse requests instead of one request per cell.
 */
export function batchedMediaRows(
  panelPath: string,
  conversion: string,
  ids: number[]
): Promise<MediaItem[]> {
  const key = `${panelPath}\n${conversion}`
  const validIds = ids.filter((id) => Number.isSafeInteger(id) && id > 0)
  if (!validIds.length) return Promise.resolve([])
  let batch = batches.get(key)
  if (!batch) {
    const pending = new Set<number>()
    const promise = Promise.resolve().then(async () => {
      batches.delete(key)
      const all = [...pending]
      const found = new Map<number, MediaItem>()
      const failed = new Set<number>()
      const chunks = Array.from({ length: Math.ceil(all.length / MAX_IDS) }, (_, index) =>
        all.slice(index * MAX_IDS, (index + 1) * MAX_IDS)
      )
      const results = await Promise.allSettled(
        chunks.map((chunk) => {
          const params = new URLSearchParams({ conversion })
          chunk.forEach((id, index) => params.set(`ids[${index}]`, String(id)))
          return mediaRows(`${panelPath}/_pupitre/media?${params}`)
        })
      )
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') for (const item of result.value) found.set(item.id, item)
        else for (const id of chunks[index]) failed.add(id)
      })
      return { found, failed }
    })
    batch = { ids: pending, promise }
    batches.set(key, batch)
  }
  for (const id of validIds) batch.ids.add(id)
  return batch.promise.then(({ found, failed }) => {
    if (validIds.some((id) => failed.has(id))) throw new Error(t('Media request failed'))
    return validIds.flatMap((id) => {
      const item = found.get(id)
      return item ? [item] : []
    })
  })
}
