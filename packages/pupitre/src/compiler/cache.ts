import { hash, stableJson } from '../definition/shared.js'

export type StaticSlot = {
  prop: string
  elementId: string
  evaluate: (
    data: Record<string, unknown>,
    record: Record<string, unknown> | null,
    ctx?: unknown,
    request?: unknown
  ) => unknown | Promise<unknown>
}
export type CachedSpec<TSpec = unknown> = { spec: TSpec; slots: StaticSlot[] }
export function createSpecCacheKey(
  panel: string,
  resource: string,
  page: string,
  locale: string,
  definition: unknown
): string {
  return `${panel}:${resource}:${page}:${locale}:${hash(stableJson(definition))}`
}

export class SpecCache<TSpec = unknown> {
  #entries = new Map<string, CachedSpec<TSpec>>()

  get(key: string): CachedSpec<TSpec> | undefined {
    return this.#entries.get(key)
  }

  set(key: string, value: CachedSpec<TSpec>): void {
    this.#entries.set(key, value)
  }

  clear(): void {
    this.#entries.clear()
  }

  get size(): number {
    return this.#entries.size
  }
}
