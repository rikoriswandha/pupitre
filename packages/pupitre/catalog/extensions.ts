import { z } from 'zod'
import { pupitreCatalog } from './registry.js'
import { dynamic } from './expressions.js'

export type CatalogExtensionComponent = {
  kind: 'field' | 'column' | 'entry'
  props: z.ZodObject
  description: string
}
export type CatalogExtension<
  C extends Record<string, CatalogExtensionComponent> = Record<string, CatalogExtensionComponent>,
> = {
  readonly name: string
  readonly components: C
}

/** Shared, execution-free contract for a host or plugin component family. */
export function defineCatalogExtension<const C extends Record<string, CatalogExtensionComponent>>(
  extension: CatalogExtension<C>
): CatalogExtension<C> {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(extension.name))
    throw new Error(`Invalid Pupitre catalog extension name "${extension.name}"; use kebab-case`)
  for (const [name, component] of Object.entries(extension.components)) {
    if (Object.hasOwn(pupitreCatalog.components, name))
      throw new Error(`Pupitre catalog component "${name}" collides with a built-in component`)
    if (
      !['field', 'column', 'entry'].includes(component.kind) ||
      !(component.props instanceof z.ZodObject)
    )
      throw new Error(
        `Invalid Pupitre catalog component "${name}" in extension "${extension.name}"`
      )
  }
  return extension
}

/** Merge per registry/panel, never through process-global browser state. */
export function mergeCatalogExtensions(extensions: readonly CatalogExtension[] = []) {
  const components: Record<string, { props: z.ZodType; description: string }> = {
    ...pupitreCatalog.components,
  }
  const names = new Set<string>()
  for (const extension of extensions) {
    defineCatalogExtension(extension)
    if (names.has(extension.name))
      throw new Error(`Duplicate Pupitre catalog extension "${extension.name}"`)
    names.add(extension.name)
    for (const [name, component] of Object.entries(extension.components)) {
      if (Object.hasOwn(components, name))
        throw new Error(
          `Pupitre catalog component "${name}" collides in extension "${extension.name}"`
        )
      // Bindings/expressions are the same protocol as built-in fields. Custom props
      // are validated raw on the server, before expressions enter the wire spec.
      const props =
        component.kind === 'field'
          ? component.props
              .safeExtend({
                name: z.string(),
                label: dynamic(z.string().nullable()).optional(),
                value: z.unknown(),
                error: dynamic(z.string().nullable()).optional(),
                required: z.boolean().optional(),
                disabled: dynamic(z.boolean()).optional(),
                readOnly: z.boolean().optional(),
                helperText: z.string().nullable().optional(),
                hint: z.string().nullable().optional(),
                placeholder: dynamic(z.string().nullable()).optional(),
                columnSpan: z.union([z.number(), z.literal('full')]).optional(),
              })
              .passthrough()
          : component.props
              .safeExtend({
                label: z.string().nullable().optional(),
                value: z.unknown(),
                record: z.unknown().optional(),
              })
              .passthrough()
      components[name] = { props, description: component.description }
    }
  }
  return { components, actions: pupitreCatalog.actions }
}
