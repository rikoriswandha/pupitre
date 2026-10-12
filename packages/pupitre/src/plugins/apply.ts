import type { ApplicationService } from '@adonisjs/core/types'
import { mergeCatalogExtensions } from '../../catalog/extensions.js'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { panelBuilder } from '../builder/panel.js'
import type { NavEntryDefinition } from '../definition/navigation.js'
import type { PanelDefinition } from '../definition/panel.js'
import type { PupitrePlugin } from '../definition/plugin.js'
import type { ResourceDefinition } from '../definition/resource.js'
import type PupitreManager from '../manager.js'
import type { PanelRuntime } from '../manager.js'

type Entries = readonly unknown[] | Record<string, unknown>

function values(source: Entries | undefined): unknown[] {
  if (!source) return []
  return Array.isArray(source) ? [...source] : Object.values(source)
}

function merge(own: Entries | undefined, added: Entries | undefined): Entries | undefined {
  if (!added) return own
  return [...values(own), ...values(added)]
}

function navEntry(value: unknown): NavEntryDefinition {
  if (
    value &&
    typeof value === 'object' &&
    'toDefinition' in value &&
    typeof value.toDefinition === 'function'
  )
    return value.toDefinition() as NavEntryDefinition
  return value as NavEntryDefinition
}

/**
 * Applies `register()` and the declarative contributions of every plugin of the
 * panel, in declaration order. Returns a new definition; never mutates input.
 */
export function applyPlugins(input: PanelDefinition): PanelDefinition {
  const plugins = input.plugins ?? []
  mergeCatalogExtensions(plugins.flatMap((plugin) => plugin.catalog ?? []))
  let definition = input
  for (const plugin of plugins) {
    if (plugin.register) {
      const result = plugin.register(panelBuilder(definition))
      if (result) {
        const next = result.toDefinition()
        if (next.id !== definition.id)
          throw new Error(`Pupitre plugin "${plugin.name}" cannot change the panel id`)
        if (next.plugins !== definition.plugins)
          throw new Error(`Pupitre plugin "${plugin.name}" cannot register other plugins`)
        definition = next
      }
    }
    const navigation = (plugin.navigation ?? []).map(navEntry)
    definition = {
      ...definition,
      resources: merge(definition.resources, plugin.resources) ?? [],
      pages: merge(definition.pages, plugin.pages) ?? [],
      widgets: merge(definition.widgets, plugin.widgets),
      middleware: plugin.middleware
        ? [...definition.middleware, ...plugin.middleware]
        : definition.middleware,
      ...(navigation.length
        ? definition.navigation
          ? { navigation: [...definition.navigation, ...navigation] }
          : { pluginNavigation: [...(definition.pluginNavigation ?? []), ...navigation] }
        : {}),
    }
  }
  return { ...definition, plugins }
}

/** Runs every plugin's `extendResource()` over one resource definition. */
export function extendResource(
  panel: PanelDefinition,
  resource: ResourceDefinition<LucidRow>,
  parent?: string
): ResourceDefinition<LucidRow> {
  let current = resource
  for (const plugin of panel.plugins ?? []) {
    if (!plugin.extendResource) continue
    const next = plugin.extendResource(current, { panel, ...(parent ? { parent } : {}) })
    if (!next) continue
    if (next.slug !== current.slug || next.modelClass !== current.modelClass)
      throw new Error(
        `Pupitre plugin "${plugin.name}" cannot change the slug or model of resource "${current.slug}"`
      )
    current = next
  }
  return current
}

/** Calls `boot()` of every plugin of a resolved panel, in declaration order. */
export async function bootPlugins(
  app: ApplicationService,
  manager: PupitreManager,
  panel: PanelRuntime
): Promise<void> {
  for (const plugin of panel.plugins as readonly PupitrePlugin[]) {
    if (plugin.boot) await plugin.boot({ app, manager, panel })
  }
}
