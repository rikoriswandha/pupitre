import { actions } from './actions.js'
import { components } from './components.js'

export const pupitreCatalog: { components: typeof components; actions: typeof actions } = {
  components,
  actions,
}

export function assertRegistryComplete(
  catalog: { components: Record<string, unknown> },
  registry: Record<string, unknown>
): void {
  const catalogNames = new Set(Object.keys(catalog.components))
  const registryNames = new Set(Object.keys(registry))
  const missing = [...catalogNames].filter((name) => !registryNames.has(name)).sort()
  const unknown = [...registryNames].filter((name) => !catalogNames.has(name)).sort()
  if (missing.length || unknown.length) {
    const details = [
      missing.length ? `Missing components: ${missing.join(', ')}` : '',
      unknown.length ? `Unknown extras: ${unknown.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    throw new Error(`Pupitre component registry is incomplete.\n${details}`)
  }
}
