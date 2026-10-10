import type { PanelDefinition } from '../definition/panel.js'
import { stableJson } from '../definition/shared.js'
export type PanelBuilder = {
  readonly definition: PanelDefinition
  path(value: string): PanelBuilder
  guard(value: string): PanelBuilder
  middleware(value: PanelDefinition['middleware']): PanelBuilder
  resources(value: readonly unknown[] | Record<string, unknown>): PanelBuilder
  brand(value: NonNullable<PanelDefinition['brand']>): PanelBuilder
  theme(value: NonNullable<PanelDefinition['theme']>): PanelBuilder
  timezone(value: string): PanelBuilder
  locale(value: 'en'): PanelBuilder
  breadcrumbs(value: boolean): PanelBuilder
  toDefinition(): PanelDefinition
  toJSON(): string
}
class Panel implements PanelBuilder {
  constructor(readonly definition: PanelDefinition) {}
  private set(patch: Partial<PanelDefinition>): PanelBuilder {
    const next = { ...this.definition, ...patch }
    next.toJSON = () =>
      stableJson(Object.fromEntries(Object.entries(next).filter(([key]) => key !== 'toJSON')))
    return new Panel(next)
  }
  path(value: string): PanelBuilder {
    return this.set({ path: value })
  }
  guard(value: string): PanelBuilder {
    return this.set({ guard: value })
  }
  middleware(value: PanelDefinition['middleware']): PanelBuilder {
    return this.set({ middleware: [...value] })
  }
  resources(value: readonly unknown[] | Record<string, unknown>): PanelBuilder {
    const resources = Array.isArray(value)
      ? value.map((resource) => {
          if (
            resource &&
            typeof resource === 'object' &&
            'toDefinition' in resource &&
            typeof resource.toDefinition === 'function'
          ) {
            return resource.toDefinition()
          }
          return resource
        })
      : value
    return this.set({ resources })
  }
  brand(value: NonNullable<PanelDefinition['brand']>): PanelBuilder {
    return this.set({ brand: { ...value } })
  }
  theme(value: NonNullable<PanelDefinition['theme']>): PanelBuilder {
    return this.set({ theme: { ...value } })
  }
  timezone(value: string): PanelBuilder {
    return this.set({ timezone: value })
  }
  locale(value: 'en'): PanelBuilder {
    return this.set({ locale: value })
  }
  breadcrumbs(value: boolean): PanelBuilder {
    return this.set({ breadcrumbs: value })
  }
  toDefinition(): PanelDefinition {
    return this.definition
  }
  toJSON(): string {
    return this.definition.toJSON()
  }
}
export function definePanel(id: string): PanelBuilder {
  const definition: PanelDefinition = {
    id,
    path: `/${id}`,
    middleware: [],
    resources: [],
    breadcrumbs: true,
    toJSON: () => '',
  }
  definition.toJSON = () =>
    stableJson(Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'toJSON')))
  return new Panel(definition)
}
