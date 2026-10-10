import type { HttpContext } from '@adonisjs/core/http'
import type { FormSchema, SchemaComponent, ComponentDefinition } from '../definition/schema.js'
import type {
  ResourceDefinition,
  ResourceData,
  ResourceHooks,
  ResourceHandlers,
  PolicyClass,
} from '../definition/resource.js'
import type { TableSchema } from '../definition/table.js'
import type { ResourceActions } from '../definition/action.js'
import { kebab, pluralize, stableJson } from '../definition/shared.js'
import { createFormSchema, getComponentDefinition } from './schema/schema.js'
import { Table } from './table/table.js'
import type { PageBuilder } from './pages.js'
import type { LucidRow, ModelAttributes } from '@adonisjs/lucid/types/model'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ModelRelationTypes } from '@adonisjs/lucid/types/relations'
export type ModelConstructor = {
  new (...args: never[]): object
  name: string
  $columns?: readonly string[]
}
type ModelInstance<M extends ResourceModel> = InstanceType<M>
type AttributeInstance<M extends ResourceModel> =
  ModelInstance<M> extends LucidRow ? ModelAttributes<ModelInstance<M>> : ModelInstance<M>
type NonAttributeKeys<I> = {
  [K in keyof I]-?: I[K] extends (...args: never[]) => unknown
    ? K
    : I[K] extends ModelRelationTypes
      ? K
      : never
}[keyof I]
type ModelField<M extends ResourceModel> = M extends {
  readonly $columns: readonly (infer Column)[]
}
  ? Extract<Column, string>
  : [Extract<keyof AttributeInstance<M>, string>] extends [never]
    ? Extract<
        Exclude<keyof ModelInstance<M>, NonAttributeKeys<ModelInstance<M>> | `$${string}`>,
        string
      >
    : Extract<keyof AttributeInstance<M>, string>
export type ResourceModel = ModelConstructor
export type ResourceBuilder<M extends ResourceModel> = {
  slug(value: string): ResourceBuilder<M>
  label(value: string): ResourceBuilder<M>
  pluralLabel(value: string): ResourceBuilder<M>
  icon(value: string): ResourceBuilder<M>
  navigation(value: {
    group?: string
    sort?: number
    badge?: (ctx: HttpContext) => unknown | Promise<unknown>
  }): ResourceBuilder<M>
  recordTitle(value: string): ResourceBuilder<M>
  policy(value: PolicyClass | (() => Promise<{ default: PolicyClass }>)): ResourceBuilder<M>
  scope(
    value: (query: ModelQueryBuilderContract<LucidModel>, ctx: HttpContext) => void
  ): ResourceBuilder<M>
  form(
    callback: (
      schema: FormSchema<Record<ModelField<M>, unknown>>
    ) => { components: ComponentDefinition[] } | readonly SchemaComponent[]
  ): ResourceBuilder<M>
  table(callback: (table: TableSchema) => TableSchema): ResourceBuilder<M>
  infolist(
    callback: (
      schema: FormSchema<Record<string, unknown>>
    ) =>
      | { components?: ComponentDefinition[]; entries?: ComponentDefinition[] }
      | readonly SchemaComponent[]
  ): ResourceBuilder<M>
  actions(value: ResourceActions): ResourceBuilder<M>
  pages(
    value: Partial<Record<'list' | 'create' | 'edit' | 'view', PageBuilder>>
  ): ResourceBuilder<M>
  fill(
    value: (record: ModelInstance<M>, ctx: HttpContext) => ResourceData | Promise<ResourceData>
  ): ResourceBuilder<M>
  mutateBeforeCreate(
    value: (
      data: ResourceData,
      ctx: HttpContext
    ) => ResourceData | void | Promise<ResourceData | void>
  ): ResourceBuilder<M>
  mutateBeforeSave(
    value: (
      data: ResourceData,
      record: ModelInstance<M> | null,
      ctx: HttpContext
    ) => ResourceData | void | Promise<ResourceData | void>
  ): ResourceBuilder<M>
  beforeCreate(
    value: (data: ResourceData, ctx: HttpContext) => unknown | Promise<unknown>
  ): ResourceBuilder<M>
  afterCreate(
    value: (record: ModelInstance<M>, ctx: HttpContext) => unknown | Promise<unknown>
  ): ResourceBuilder<M>
  beforeSave(
    value: (
      record: ModelInstance<M> | null,
      data: ResourceData,
      ctx: HttpContext
    ) => unknown | Promise<unknown>
  ): ResourceBuilder<M>
  afterSave(
    value: (record: ModelInstance<M>, ctx: HttpContext) => unknown | Promise<unknown>
  ): ResourceBuilder<M>
  beforeDelete(
    value: (record: ModelInstance<M>, ctx: HttpContext) => unknown | Promise<unknown>
  ): ResourceBuilder<M>
  afterDelete(
    value: (record: ModelInstance<M>, ctx: HttpContext) => unknown | Promise<unknown>
  ): ResourceBuilder<M>
  create(
    value: (data: ResourceData, ctx: HttpContext) => Promise<ModelInstance<M>>
  ): ResourceBuilder<M>
  update(
    value: (
      record: ModelInstance<M>,
      data: ResourceData,
      ctx: HttpContext
    ) => Promise<ModelInstance<M>>
  ): ResourceBuilder<M>
  toDefinition(): ResourceDefinition<ModelInstance<M>>
  readonly definition: ResourceDefinition<ModelInstance<M>>
  toJSON(): string
}
function componentList(
  value:
    | { components?: ComponentDefinition[]; entries?: ComponentDefinition[] }
    | readonly SchemaComponent[]
): ComponentDefinition[] {
  if (Array.isArray(value))
    return (value as readonly SchemaComponent[]).map((item) => getComponentDefinition(item))
  const object = value as { components?: ComponentDefinition[]; entries?: ComponentDefinition[] }
  return object.components ?? object.entries ?? []
}
class Resource<M extends ResourceModel> implements ResourceBuilder<M> {
  constructor(readonly definition: ResourceDefinition<ModelInstance<M>>) {}
  private change(patch: Partial<ResourceDefinition<ModelInstance<M>>>): ResourceBuilder<M> {
    const next = { ...this.definition, ...patch }
    next.toJSON = () =>
      stableJson(Object.fromEntries(Object.entries(next).filter(([key]) => key !== 'toJSON')))
    return new Resource(next)
  }
  slug(value: string): ResourceBuilder<M> {
    return this.change({ slug: value })
  }
  label(value: string): ResourceBuilder<M> {
    return this.change({ label: value })
  }
  pluralLabel(value: string): ResourceBuilder<M> {
    return this.change({ pluralLabel: value })
  }
  icon(value: string): ResourceBuilder<M> {
    return this.change({ icon: value })
  }
  navigation(value: {
    group?: string
    sort?: number
    badge?: (ctx: HttpContext) => unknown | Promise<unknown>
  }): ResourceBuilder<M> {
    return this.change({ navigation: value })
  }
  recordTitle(value: string): ResourceBuilder<M> {
    return this.change({ recordTitle: value })
  }
  policy(value: PolicyClass | (() => Promise<{ default: PolicyClass }>)): ResourceBuilder<M> {
    return this.change({ policy: value })
  }
  scope(
    value: (query: ModelQueryBuilderContract<LucidModel>, ctx: HttpContext) => void
  ): ResourceBuilder<M> {
    return this.change({ scope: value })
  }
  form(
    callback: (
      schema: FormSchema<Record<ModelField<M>, unknown>>
    ) => { components: ComponentDefinition[] } | readonly SchemaComponent[]
  ): ResourceBuilder<M> {
    return this.change({
      form: componentList(callback(createFormSchema<Record<ModelField<M>, unknown>>())),
    })
  }
  table(callback: (table: TableSchema) => TableSchema): ResourceBuilder<M> {
    const initial = new Table({
      columns: [],
      filters: [],
      filtersLayout: 'dropdown',
      searchDebounce: 300,
      paginated: [10, 25, 50],
      striped: false,
    })
    return this.change({ table: callback(initial).toDefinition() })
  }
  infolist(
    callback: (
      schema: FormSchema<Record<string, unknown>>
    ) =>
      | { components?: ComponentDefinition[]; entries?: ComponentDefinition[] }
      | readonly SchemaComponent[]
  ): ResourceBuilder<M> {
    const infolist = componentList(callback(createFormSchema<Record<string, unknown>>()))
    const pages = this.definition.pages.view
      ? this.definition.pages
      : { ...this.definition.pages, view: { kind: 'view' as const } }
    return this.change({ infolist, pages })
  }
  actions(value: ResourceActions): ResourceBuilder<M> {
    return this.change({
      actions: {
        header: (value.header ?? []).map((item) => item.definition),
        row: (value.row ?? []).map((item) => item.definition),
        bulk: (value.bulk ?? []).map((item) => item.definition),
      },
    })
  }
  pages(
    value: Partial<Record<'list' | 'create' | 'edit' | 'view', PageBuilder>>
  ): ResourceBuilder<M> {
    return this.change({
      pages: Object.fromEntries(
        Object.entries(value).map(([key, page]) => [key, page?.definition])
      ) as ResourceDefinition['pages'],
    })
  }
  fill(value: NonNullable<ResourceHooks<ModelInstance<M>>['fill']>): ResourceBuilder<M> {
    return this.updateHooks({ fill: value })
  }
  mutateBeforeCreate(
    value: NonNullable<ResourceHooks<ModelInstance<M>>['mutateBeforeCreate']>
  ): ResourceBuilder<M> {
    return this.updateHooks({ mutateBeforeCreate: value })
  }
  mutateBeforeSave(
    value: NonNullable<ResourceHooks<ModelInstance<M>>['mutateBeforeSave']>
  ): ResourceBuilder<M> {
    return this.updateHooks({ mutateBeforeSave: value })
  }
  beforeCreate(
    value: NonNullable<ResourceHooks<ModelInstance<M>>['beforeCreate']>
  ): ResourceBuilder<M> {
    return this.updateHooks({ beforeCreate: value })
  }
  afterCreate(
    value: NonNullable<ResourceHooks<ModelInstance<M>>['afterCreate']>
  ): ResourceBuilder<M> {
    return this.updateHooks({ afterCreate: value })
  }
  beforeSave(
    value: NonNullable<ResourceHooks<ModelInstance<M>>['beforeSave']>
  ): ResourceBuilder<M> {
    return this.updateHooks({ beforeSave: value })
  }
  afterSave(value: NonNullable<ResourceHooks<ModelInstance<M>>['afterSave']>): ResourceBuilder<M> {
    return this.updateHooks({ afterSave: value })
  }
  beforeDelete(
    value: NonNullable<ResourceHooks<ModelInstance<M>>['beforeDelete']>
  ): ResourceBuilder<M> {
    return this.updateHooks({ beforeDelete: value })
  }
  afterDelete(
    value: NonNullable<ResourceHooks<ModelInstance<M>>['afterDelete']>
  ): ResourceBuilder<M> {
    return this.updateHooks({ afterDelete: value })
  }
  create(value: NonNullable<ResourceHandlers<ModelInstance<M>>['create']>): ResourceBuilder<M> {
    return this.updateHandlers({ create: value })
  }
  update(value: NonNullable<ResourceHandlers<ModelInstance<M>>['update']>): ResourceBuilder<M> {
    return this.updateHandlers({ update: value })
  }
  private updateHooks(patch: Partial<ResourceHooks<ModelInstance<M>>>): ResourceBuilder<M> {
    return this.change({ hooks: { ...this.definition.hooks, ...patch } })
  }
  private updateHandlers(patch: Partial<ResourceHandlers<ModelInstance<M>>>): ResourceBuilder<M> {
    return this.change({ handlers: { ...this.definition.handlers, ...patch } })
  }
  toDefinition(): ResourceDefinition<ModelInstance<M>> {
    return this.definition
  }
  toJSON(): string {
    return this.definition.toJSON()
  }
}
export function defineResource<M extends ResourceModel>(model: M): ResourceBuilder<M> {
  const modelName = model.name.replace(/Model$/, '')
  const definition: ResourceDefinition<ModelInstance<M>> = {
    model: model.name,
    slug: pluralize(kebab(modelName)),
    label: modelName,
    pluralLabel: pluralize(modelName),
    pages: {
      list: { kind: 'list' },
      create: { kind: 'create' },
      edit: { kind: 'edit' },
    },
    hooks: {},
    handlers: {},
    toJSON: () => '',
  }
  definition.toJSON = () =>
    stableJson(Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'toJSON')))
  return new Resource<M>(definition)
}
