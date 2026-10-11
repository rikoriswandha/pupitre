import type { ComponentDefinition, FormSchema, SchemaNodeBuilder } from '../definition/schema.js'
import type { ActionBuilder } from '../definition/action.js'
import type { CustomPageDefinition } from '../definition/custom_page.js'
import { stableJson } from '../definition/shared.js'
import { createFormSchema, getComponentDefinition } from './schema/schema.js'
import type { WidgetBuilder } from './widget.js'
import type { WidgetFilterDefinition } from '../definition/widget.js'

type FormInput = readonly SchemaNodeBuilder[] | { components?: ComponentDefinition[] }

function isNodeArray(value: FormInput): value is readonly SchemaNodeBuilder[] {
  return Array.isArray(value)
}

export type CustomPageBuilder = {
  readonly definition: CustomPageDefinition
  path(value: string): CustomPageBuilder
  title(value: string): CustomPageBuilder
  icon(value: string): CustomPageBuilder
  navigation(value: NonNullable<CustomPageDefinition['navigation']>): CustomPageBuilder
  canAccess(value: NonNullable<CustomPageDefinition['canAccess']>): CustomPageBuilder
  form(callback: (schema: FormSchema<Record<string, unknown>>) => FormInput): CustomPageBuilder
  fill(value: NonNullable<CustomPageDefinition['fill']>): CustomPageBuilder
  save(value: NonNullable<CustomPageDefinition['save']>): CustomPageBuilder
  actions(value: readonly ActionBuilder[]): CustomPageBuilder
  component(value: string): CustomPageBuilder
  widgets(value: readonly WidgetBuilder[]): CustomPageBuilder
  filters(value: readonly WidgetFilterDefinition[]): CustomPageBuilder
  toDefinition(): CustomPageDefinition
  toJSON(): string
}

class PageBuilder implements CustomPageBuilder {
  constructor(readonly definition: CustomPageDefinition) {}

  private change(patch: Partial<CustomPageDefinition>): CustomPageBuilder {
    const next = { ...this.definition, ...patch }
    next.toJSON = () =>
      stableJson(Object.fromEntries(Object.entries(next).filter(([key]) => key !== 'toJSON')))
    return new PageBuilder(next)
  }

  path(value: string) {
    return this.change({ path: value })
  }
  title(value: string) {
    return this.change({ title: value })
  }
  icon(value: string) {
    return this.change({ icon: value })
  }
  navigation(value: NonNullable<CustomPageDefinition['navigation']>) {
    return this.change({ navigation: value })
  }
  canAccess(value: NonNullable<CustomPageDefinition['canAccess']>) {
    return this.change({ canAccess: value })
  }
  form(callback: (schema: FormSchema<Record<string, unknown>>) => FormInput) {
    const result = callback(createFormSchema<Record<string, unknown>>())
    const nodes = isNodeArray(result)
      ? result.map((item) => getComponentDefinition(item))
      : (result.components ?? [])
    return this.change({ form: nodes })
  }
  fill(value: NonNullable<CustomPageDefinition['fill']>) {
    return this.change({ fill: value })
  }
  save(value: NonNullable<CustomPageDefinition['save']>) {
    return this.change({ save: value })
  }
  actions(value: readonly ActionBuilder[]) {
    return this.change({
      actions: value.map((item) => ({ ...item.definition, context: 'header' as const })),
    })
  }
  component(value: string) {
    return this.change({ component: value })
  }
  widgets(value: readonly WidgetBuilder[]) {
    return this.change({ widgets: value.map((widget) => widget.toDefinition()) })
  }
  filters(value: readonly WidgetFilterDefinition[]) {
    return this.change({
      filters: value.map((filter) => ({ ...filter, options: [...filter.options] })),
    })
  }
  toDefinition() {
    return this.definition
  }
  toJSON() {
    return this.definition.toJSON()
  }
}

export function definePage(slug: string): CustomPageBuilder {
  const definition: CustomPageDefinition = {
    slug,
    path: `/${slug}`,
    title: slug.replace(/[-_]/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase()),
    form: undefined,
    actions: [],
    toJSON: () => '',
  }
  definition.toJSON = () =>
    stableJson(Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'toJSON')))
  return new PageBuilder(definition)
}
