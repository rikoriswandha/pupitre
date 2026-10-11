import type { ApplicationService } from '@adonisjs/core/types'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { PanelBuilder } from '../builder/panel.js'
import type { PanelDefinition } from './panel.js'
import type { NavEntryDefinition } from './navigation.js'
import type { ResourceDefinition } from './resource.js'
import type PupitreManager from '../manager.js'
import type { PanelRuntime } from '../manager.js'

type Definable<T> = T | { toDefinition(): T }

/** Context handed to `plugin.boot()` once per panel, after resolution and before routes. */
export type PluginBootContext = {
  app: ApplicationService
  manager: PupitreManager
  /** Fully resolved panel (plugin contributions included). */
  panel: PanelRuntime
}

/** Context handed to `plugin.extendResource()`. */
export type PluginResourceContext = {
  /** Panel definition after every plugin's `register()` and contributions were applied. */
  panel: PanelDefinition
  /** Slug of the parent resource when the resource is registered as nested. */
  parent?: string
}

/**
 * A Pupitre plugin (WP36). Plugins are plain objects; packages usually export a
 * factory (`shield({ ... })`) returning `definePlugin({ ... })`.
 *
 * Application order per panel, in the order passed to `.plugins([...])`:
 * 1. `register(panel)` — may return a new builder (panel builders are immutable).
 * 2. `resources`, `pages`, `widgets` are appended to the panel's own entries,
 *    `middleware` after the panel middleware, `navigation` to the panel navigation.
 * 3. `extendResource(resource)` runs for every resource of the panel (nested included).
 * 4. `boot({ app, manager, panel })` runs once the panel is resolved, before routes.
 */
export type PupitrePlugin = {
  /** Unique kebab-case identifier, e.g. `shield` or `acme-audit`. */
  readonly name: string
  register?(panel: PanelBuilder): PanelBuilder | void
  resources?: readonly unknown[] | Record<string, unknown>
  pages?: readonly unknown[] | Record<string, unknown>
  widgets?: readonly unknown[] | Record<string, unknown>
  middleware?: PanelDefinition['middleware']
  navigation?: readonly Definable<NavEntryDefinition>[]
  extendResource?(
    resource: ResourceDefinition<LucidRow>,
    context: PluginResourceContext
  ): ResourceDefinition<LucidRow> | void
  boot?(context: PluginBootContext): void | Promise<void>
}
