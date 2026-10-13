import { prepareClusters } from './navigation/clusters.js'
import type { ApplicationService, HttpRouterService } from '@adonisjs/core/types'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { PanelDefinition } from './definition/panel.js'
import type { ResourceDefinition } from './definition/resource.js'
import type { CustomPageDefinition } from './definition/custom_page.js'
import { registerPanelRoutes } from './http/router.js'
import { validateNavigation } from './navigation/validate.js'
import { resolveAdapter } from './define_config.js'
import type { PupitreConfig } from './define_config.js'
import { registerExportJob } from './table/export_job.js'
import { registerImportJob } from './jobs/import_job.js'
import { registerBulkJob } from './jobs/bulk_job.js'
import type { WidgetDefinition } from './definition/widget.js'
import type { JobsAdapter } from './adapters/jobs.js'
import { applyPlugins, bootPlugins, extendResource } from './plugins/apply.js'
import type { RealtimeAdapter } from './adapters/realtime.js'
import type { RealtimeEvent } from '../catalog/wire.js'
import { missingPolicies } from './authz/strict.js'
import { E_PUPITRE_MISSING_POLICY } from './errors.js'
import { E_PUPITRE_AUTH_LOGIN_REQUIRED } from './errors.js'

export type ResourceRuntime = {
  slug: string
  routeSlug: string
  parent?: { resource: string; relation: string; param: string }
  definition: ResourceDefinition<LucidRow>
  model: LucidModel
  label: string
  pluralLabel: string
  urls: {
    list: string
    create: string
    edit(id: string | number): string
    update(id: string | number): string
    view(id: string | number): string
    destroy(id: string | number): string
    actions(name: string, id?: string | number): string
  }
}

/** A custom page (`definePage`) registered on a panel (WP23 resolves them). */
export type PageRuntime = {
  slug: string
  definition: CustomPageDefinition
  /** Request-bound absolute URL (tenant segment included in mode `url`). */
  url: string
}

export type PanelRuntime = Omit<PanelDefinition, 'resources' | 'pages' | 'widgets'> & {
  resources: ResourceRuntime[]
  pages: PageRuntime[]
  widgets: WidgetDefinition[]
}
type LazyModule<T> = () => Promise<{ default: T }>
type PanelInput =
  PanelDefinition | { toDefinition(): PanelDefinition } | { definition: PanelDefinition }

function asDefinition<T>(value: T | { toDefinition(): T } | { definition: T }): T {
  if (
    value &&
    typeof value === 'object' &&
    'toDefinition' in value &&
    typeof value.toDefinition === 'function'
  ) {
    return value.toDefinition()
  }
  if (value && typeof value === 'object' && 'definition' in value) return value.definition
  return value as T
}

function isLazyModule(value: unknown): value is LazyModule<PanelInput> {
  return typeof value === 'function'
}

function validSlug(value: string): boolean {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)
}
const RESERVED_PAGE_SLUGS: Record<string, true> = {
  locale: true,
  dashboard: true,
  search: true,
  notifications: true,
  options: true,
  upload: true,
  profile: true,
  login: true,
  logout: true,
  register: true,
  password: true,
  email: true,
  tenant: true,
  _pupitre: true,
}
const RESERVED_PAGE_PATHS: Record<string, true> = {
  '/locale': true,
  '/': true,
  '/dashboard': true,
  '/search': true,
  '/notifications': true,
  '/options': true,
  '/upload': true,
  '/profile': true,
  '/login': true,
  '/logout': true,
  '/register': true,
  '/password': true,
  '/email': true,
  '/tenant': true,
  '/_pupitre': true,
}

/** URL builders for one resource under a (possibly tenant-prefixed) panel path. */
export function resourceUrls(panelPath: string, slug: string): ResourceRuntime['urls'] {
  const base = `${panelPath.replace(/\/$/, '')}/${slug}`
  return {
    list: base,
    create: `${base}/create`,
    edit: (id) => `${base}/${encodeURIComponent(String(id))}/edit`,
    update: (id) => `${base}/${encodeURIComponent(String(id))}`,
    view: (id) => `${base}/${encodeURIComponent(String(id))}`,
    destroy: (id) => `${base}/${encodeURIComponent(String(id))}`,
    actions: (name, id) =>
      `${base}/${id === undefined ? '' : `${encodeURIComponent(String(id))}/`}actions/${encodeURIComponent(name)}`,
  }
}

/** Absolute URL of a custom page under a (possibly tenant-prefixed) panel path. */
export function pageUrl(panelPath: string, pagePath: string): string {
  return `${panelPath.replace(/\/$/, '')}/${pagePath.replace(/^\//, '')}`
}

/**
 * Returns a request-scoped copy of the panel whose `path`, resource URLs and
 * page URLs are rooted at `path` (e.g. `/admin/acme` in tenancy mode `url`).
 * Never mutates the boot-time runtime.
 */
export function bindPanel(panel: PanelRuntime, path: string): PanelRuntime {
  if (panel.path === path) return panel
  return {
    ...panel,
    path,
    resources: panel.resources.map((resource) => ({
      ...resource,
      urls: resourceUrls(path, resource.routeSlug),
    })),
    pages: panel.pages.map((page) => ({ ...page, url: pageUrl(path, page.definition.path) })),
  }
}

export default class PupitreManager {
  readonly panels: PanelRuntime[] = []
  jobs?: JobsAdapter
  realtime?: RealtimeAdapter
  private routesRegistered = false

  constructor(private readonly app: ApplicationService) {}
  async boot(
    inputs: Record<string, LazyModule<PanelInput> | PanelInput> | PanelInput[]
  ): Promise<void> {
    if (this.routesRegistered) return
    const values = Array.isArray(inputs)
      ? inputs.map((value) => [undefined, value] as const)
      : Object.entries(inputs)
    for (const [barrelId, input] of values) {
      let loaded: PanelInput
      if (isLazyModule(input)) {
        const module = await input()
        loaded = module.default
      } else {
        loaded = input
      }
      const declared = asDefinition<PanelDefinition>(loaded)
      if (!declared || typeof declared.id !== 'string')
        throw new Error('Pupitre panel must resolve to a panel definition')
      if (barrelId && barrelId !== declared.id)
        throw new Error(
          `Pupitre panel barrel key "${barrelId}" does not match panel id "${declared.id}"`
        )
      if (!validSlug(declared.id)) throw new Error(`Invalid Pupitre panel id "${declared.id}"`)
      const definition = applyPlugins(declared)
      if (!definition.auth.login && (definition.sessions || definition.impersonation))
        throw new E_PUPITRE_AUTH_LOGIN_REQUIRED([definition.id])
      if (definition.locales && !definition.locales.includes(definition.locale ?? 'en'))
        throw new Error('Panel default locale must be included in locales')
      const resources = await this.resolveResources(definition)
      const pages = await this.resolvePages(definition)
      const duplicate = pages.find((page) =>
        resources.some((resource) => resource.slug === page.slug)
      )
      if (duplicate)
        throw new Error(
          `Pupitre resource and page slugs must be unique in panel "${definition.id}": "${duplicate.slug}"`
        )
      const widgets = await this.resolveWidgets(definition)
      const panel: PanelRuntime = { ...definition, resources, pages, widgets }
      prepareClusters(panel)
      validateNavigation(panel)
      this.panels.push(panel)
    }
    const config = (await this.app.container.make('pupitre.config')) as PupitreConfig
    const coverage = await Promise.all(
      this.panels
        .filter((panel) => panel.strictAuthorization)
        .map((panel) => missingPolicies(panel, config))
    )
    const violations = coverage.flat()
    // Inspection is diagnostic-only: retain the resolved inventory but never serve routes.
    if (this.app.getEnvironment?.() === 'console' && process.argv.includes('pupitre:inspect'))
      return
    if (violations.length) throw new E_PUPITRE_MISSING_POLICY([violations.join(', ')])
    const jobs = await resolveAdapter(config.jobs)
    this.jobs = jobs
    if (jobs) {
      registerImportJob(jobs, this)
      registerBulkJob(jobs, this)
      await registerExportJob(jobs, this)
      await jobs.initialize?.()
    }
    this.realtime = await resolveAdapter(config.realtime)
    await this.realtime?.initialize?.(this)
    for (const panel of this.panels) await bootPlugins(this.app, this, panel)
    const router = (await this.app.container.make('router')) as HttpRouterService
    for (const panel of this.panels) registerPanelRoutes(router, panel, this)
    this.routesRegistered = true
  }

  /** Failed delivery must never turn a committed mutation into a failed request/job. */
  async publishRealtime(channel: string, event: RealtimeEvent): Promise<void> {
    if (!this.realtime) return
    try {
      await this.realtime.publish(channel, event)
    } catch (error) {
      const logger = await this.app.container.make('logger')
      logger.error({ err: error, channel }, 'Pupitre realtime publish failed')
    }
  }

  getPanel(id: string): PanelRuntime | undefined {
    return this.panels.find((panel) => panel.id === id)
  }

  private async resolvePages(panel: PanelDefinition): Promise<PageRuntime[]> {
    const source = panel.pages as unknown[] | Record<string, unknown>
    const entries = Array.isArray(source)
      ? source.map((value) => [undefined, value] as const)
      : Object.entries(source ?? {})
    const result: PageRuntime[] = []
    for (const [, value] of entries) {
      let loaded = value
      if (typeof value === 'function') {
        const module = await (value as LazyModule<unknown>)()
        loaded = module.default
      }
      const definition = asDefinition<CustomPageDefinition>(loaded as never)
      if (!definition || typeof definition.slug !== 'string')
        throw new Error(`Page in panel "${panel.id}" must resolve to a page definition`)
      if (!validSlug(definition.slug))
        throw new Error(`Invalid Pupitre page slug "${definition.slug}"`)
      if (RESERVED_PAGE_SLUGS[definition.slug])
        throw new Error(
          `Pupitre page slug "${definition.slug}" is reserved for a built-in route in panel "${panel.id}"`
        )

      if (typeof definition.path !== 'string' || !definition.path.startsWith('/'))
        throw new Error(`Page "${definition.slug}" must have a path starting with "/"`)
      const normalizedPath = definition.path.replace(/\/+$/, '') || '/'
      if (RESERVED_PAGE_PATHS[normalizedPath] || normalizedPath.startsWith('/_pupitre/'))
        throw new Error(
          `Pupitre page path "${definition.path}" is reserved for a built-in route in panel "${panel.id}"`
        )
      result.push({
        slug: definition.slug,
        definition,
        url: pageUrl(panel.path, definition.path),
      })
    }
    const pageSlugs: Record<string, true> = {}
    for (const page of result) {
      if (pageSlugs[page.slug])
        throw new Error(`Duplicate Pupitre page slug "${page.slug}" in panel "${panel.id}"`)
      pageSlugs[page.slug] = true
    }
    return result
  }
  private async resolveResources(panel: PanelDefinition): Promise<ResourceRuntime[]> {
    const source = panel.resources as unknown[] | Record<string, unknown>
    const entries = Array.isArray(source)
      ? source.map((value) => [undefined, value] as const)
      : Object.entries(source ?? {})
    const result: ResourceRuntime[] = []
    const resolveModel = (definition: ResourceDefinition<LucidRow>): LucidModel => {
      const model = definition.modelClass
      if (!model)
        throw new Error(`Resource "${definition.slug}" does not expose its Lucid model constructor`)
      return model
    }
    const registerNested = (parent: ResourceRuntime) => {
      for (const nestedChild of parent.definition.nested ?? []) {
        const child = extendResource(
          panel,
          nestedChild as unknown as ResourceDefinition<LucidRow>,
          parent.slug
        )
        if (!validSlug(child.slug)) throw new Error(`Invalid nested resource slug "${child.slug}"`)
        if (!child.parent)
          throw new Error(
            `Nested resource "${child.slug}" must declare .parent(resource, relation)`
          )
        if (child.parent.resource !== parent.slug)
          throw new Error(
            `Nested resource "${child.slug}" declares parent "${child.parent.resource}", expected "${parent.slug}"`
          )
        const model = resolveModel(child)
        const parentParam = 'parentId'
        const parentRelation = model.$getRelation(child.parent.relation)
        parentRelation.boot()
        if (parentRelation.type !== 'belongsTo')
          throw new Error(`Nested resource "${child.slug}" parent relation must be belongsTo`)
        const definition: ResourceDefinition<LucidRow> = { ...child }
        const routeSlug = `${parent.routeSlug}/:${parentParam}/${child.slug}`
        const existingIndex = result.findIndex((item) => item.slug === child.slug)
        if (existingIndex >= 0) {
          const existing = result[existingIndex]!
          if (existing.model !== model)
            throw new Error(
              `Duplicate Pupitre resource slug "${child.slug}" in panel "${panel.id}"`
            )
          if (existing.parent)
            throw new Error(`Nested Pupitre resource "${child.slug}" is registered more than once`)
          result.splice(existingIndex, 1)
        }
        const runtime: ResourceRuntime = {
          slug: child.slug,
          routeSlug,
          parent: { resource: parent.slug, relation: child.parent.relation, param: parentParam },
          definition,
          model,
          label: child.label,
          pluralLabel: child.pluralLabel,
          urls: resourceUrls(panel.path, routeSlug),
        }
        result.push(runtime)
        registerNested(runtime)
      }
    }
    for (const [, value] of entries) {
      let loaded = value
      if (typeof value === 'function') {
        const module = await (value as LazyModule<unknown>)()
        loaded = module.default
      }
      const declared = asDefinition<ResourceDefinition<LucidRow> & { modelClass?: LucidModel }>(
        loaded as never
      )
      if (!declared || typeof declared.slug !== 'string')
        throw new Error(`Resource in panel "${panel.id}" must resolve to a resource definition`)
      const definition = extendResource(panel, declared)
      if (!validSlug(definition.slug))
        throw new Error(`Invalid Pupitre resource slug "${definition.slug}"`)
      if (definition.slug === 'locale')
        throw new Error(
          `Pupitre resource slug "${definition.slug}" is reserved for a built-in route in panel "${panel.id}"`
        )
      const model = resolveModel(definition)
      if (result.some((item) => item.slug === definition.slug && item.parent)) continue
      const runtime: ResourceRuntime = {
        slug: definition.slug,
        routeSlug: definition.slug,
        definition,
        model,
        label: definition.label,
        pluralLabel: definition.pluralLabel,
        urls: resourceUrls(panel.path, definition.slug),
      }
      result.push(runtime)
      registerNested(runtime)
    }
    const slugs = new Set<string>()
    for (const resource of result) {
      if (slugs.has(resource.slug))
        throw new Error(`Duplicate Pupitre resource slug "${resource.slug}" in panel "${panel.id}"`)
      slugs.add(resource.slug)
    }
    return result
  }
  private async resolveWidgets(panel: PanelDefinition): Promise<WidgetDefinition[]> {
    const source = panel.widgets ?? []
    const entries = Array.isArray(source) ? source : Object.values(source)
    const result: WidgetDefinition[] = []
    for (const value of entries) {
      let loaded = value
      if (typeof value === 'function') {
        const imported = await (value as LazyModule<unknown>)()
        loaded =
          imported && typeof imported === 'object' && 'default' in imported
            ? imported.default
            : imported
      }
      const definition = asDefinition<WidgetDefinition>(loaded as never)
      if (!definition || typeof definition.name !== 'string')
        throw new Error(`Widget in panel "${panel.id}" must resolve to a widget definition`)
      result.push(definition)
    }
    return result.sort((left, right) => left.sort - right.sort)
  }
}
