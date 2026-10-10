import type { ApplicationService, HttpRouterService } from '@adonisjs/core/types'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { PanelDefinition } from './definition/panel.js'
import type { ResourceDefinition } from './definition/resource.js'
import { registerPanelRoutes } from './http/router.js'

export type ResourceRuntime = {
  slug: string
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

export type PanelRuntime = Omit<PanelDefinition, 'resources'> & { resources: ResourceRuntime[] }
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

export default class PupitreManager {
  readonly panels: PanelRuntime[] = []
  private routesRegistered = false
  private readonly resourcesByPanel = new Map<string, Map<string, ResourceRuntime>>()

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
      const definition = asDefinition<PanelDefinition>(loaded)
      if (!definition || typeof definition.id !== 'string')
        throw new Error('Pupitre panel must resolve to a panel definition')
      if (barrelId && barrelId !== definition.id)
        throw new Error(
          `Pupitre panel barrel key "${barrelId}" does not match panel id "${definition.id}"`
        )
      if (!validSlug(definition.id)) throw new Error(`Invalid Pupitre panel id "${definition.id}"`)
      const resources = await this.resolveResources(definition)
      const panel: PanelRuntime = { ...definition, resources }
      this.panels.push(panel)
      this.resourcesByPanel.set(
        panel.id,
        new Map(resources.map((resource) => [resource.slug, resource]))
      )
    }
    const router = (await this.app.container.make('router')) as HttpRouterService
    for (const panel of this.panels) registerPanelRoutes(router, panel, this)
    this.routesRegistered = true
  }

  getPanel(id: string): PanelRuntime | undefined {
    return this.panels.find((panel) => panel.id === id)
  }

  findResource(panelId: string, slug: string): ResourceRuntime | undefined {
    return this.resourcesByPanel.get(panelId)?.get(slug)
  }

  private async resolveResources(panel: PanelDefinition): Promise<ResourceRuntime[]> {
    const source = panel.resources as unknown[] | Record<string, unknown>
    const entries = Array.isArray(source)
      ? source.map((value) => [undefined, value] as const)
      : Object.entries(source ?? {})
    const result: ResourceRuntime[] = []
    for (const [, value] of entries) {
      let loaded = value
      if (typeof value === 'function') {
        const module = await (value as LazyModule<unknown>)()
        loaded = module.default
      }
      const definition = asDefinition<ResourceDefinition<LucidRow> & { modelClass?: LucidModel }>(
        loaded as never
      )
      if (!definition || typeof definition.slug !== 'string')
        throw new Error(`Resource in panel "${panel.id}" must resolve to a resource definition`)
      if (!validSlug(definition.slug))
        throw new Error(`Invalid Pupitre resource slug "${definition.slug}"`)
      const model = definition.modelClass
      if (!model)
        throw new Error(`Resource "${definition.slug}" does not expose its Lucid model constructor`)
      const base = `${panel.path.replace(/\/$/, '')}/${definition.slug}`
      result.push({
        slug: definition.slug,
        definition,
        model,
        label: definition.label,
        pluralLabel: definition.pluralLabel,
        urls: {
          list: base,
          create: `${base}/create`,
          edit: (id) => `${base}/${encodeURIComponent(String(id))}/edit`,
          update: (id) => `${base}/${encodeURIComponent(String(id))}`,
          view: (id) => `${base}/${encodeURIComponent(String(id))}`,
          destroy: (id) => `${base}/${encodeURIComponent(String(id))}`,
          actions: (name, id) =>
            `${base}/${id === undefined ? '' : `${encodeURIComponent(String(id))}/`}actions/${encodeURIComponent(name)}`,
        },
      })
    }
    return result
  }
}
