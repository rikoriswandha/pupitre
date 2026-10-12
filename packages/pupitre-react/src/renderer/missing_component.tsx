import type { ComponentRenderProps } from '@json-render/react'
import type { ActionFormResponse } from '@rikology/pupitre/catalog'
import type { PupitreRegistry } from '../registry/defineRegistry.js'

/** Run outside json-render's element boundaries, including nested specs and columns. */
export function assertCatalogComponents(
  value: Pick<ActionFormResponse, 'spec' | 'catalogExtensions'>,
  registry: PupitreRegistry
): void {
  const assertRegistered = (name: string, extension?: string) => {
    if (!Object.hasOwn(registry.registry, name))
      throw new Error(
        `Pupitre component "${name}" is not registered${extension ? ` (extension "${extension}")` : ''}. Add it to defineRegistry() and include its catalog extension in options.extensions.`
      )
  }
  for (const extension of value.catalogExtensions ?? [])
    for (const name of extension.components) assertRegistered(name, extension.name)
  const visited = new WeakSet<object>()
  const walk = (current: unknown): void => {
    if (!current || typeof current !== 'object' || visited.has(current)) return
    visited.add(current)
    const object = current as Record<string, unknown>
    if (typeof object.root === 'string' && object.elements && typeof object.elements === 'object') {
      for (const element of Object.values(object.elements)) {
        if (
          element &&
          typeof element === 'object' &&
          'type' in element &&
          typeof element.type === 'string'
        )
          assertRegistered(element.type)
      }
    }
    if (object.type === 'custom' && typeof object.component === 'string')
      assertRegistered(object.component)
    if (Array.isArray(object.entries)) {
      for (const entry of object.entries)
        if (entry && typeof entry === 'object' && typeof entry.component === 'string')
          assertRegistered(entry.component)
    }
    for (const child of Object.values(object)) walk(child)
  }
  walk(value.spec)
}

/** Unknown spec types are configuration errors, never silently omitted UI. */
export function MissingComponent({ element }: ComponentRenderProps): never {
  throw new Error(
    `Pupitre component "${element.type}" is not registered. Add it to defineRegistry() and include its catalog extension in options.extensions.`
  )
}
