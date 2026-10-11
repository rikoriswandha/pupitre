import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { HttpContext } from '@adonisjs/core/http'
import type { ActionDefinition } from './action.js'
import type { ComponentDefinition } from './schema.js'
import type { TableDefinition } from './table.js'
import type { PageDefinition } from './page.js'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type PolicyClass = abstract new (...args: never[]) => object
export type ResourceData = Record<string, unknown>
export type ResourceHooks<Model extends object, Trx = TransactionClientContract> = {
  fill?: (record: Model, ctx: HttpContext) => ResourceData | Promise<ResourceData>
  mutateBeforeCreate?: (
    data: ResourceData,
    ctx: HttpContext,
    trx: Trx
  ) => ResourceData | void | Promise<ResourceData | void>
  mutateBeforeSave?: (
    data: ResourceData,
    record: Model | null,
    ctx: HttpContext,
    trx: Trx
  ) => ResourceData | void | Promise<ResourceData | void>
  beforeCreate?: (data: ResourceData, ctx: HttpContext, trx: Trx) => unknown | Promise<unknown>
  afterCreate?: (record: Model, ctx: HttpContext, trx: Trx) => unknown | Promise<unknown>
  beforeSave?: (
    record: Model | null,
    data: ResourceData,
    ctx: HttpContext,
    trx: Trx
  ) => unknown | Promise<unknown>
  afterSave?: (record: Model, ctx: HttpContext, trx: Trx) => unknown | Promise<unknown>
  beforeDelete?: (record: Model, ctx: HttpContext, trx: Trx) => unknown | Promise<unknown>
  afterDelete?: (record: Model, ctx: HttpContext, trx: Trx) => unknown | Promise<unknown>
}
export type ResourceHandlers<Model extends object, Trx = TransactionClientContract> = {
  create?: (data: ResourceData, ctx: HttpContext, trx: Trx) => Promise<Model>
  update?: (record: Model, data: ResourceData, ctx: HttpContext, trx: Trx) => Promise<Model>
}
export type ResourceDefinition<Model extends object = object> = {
  model: string
  modelClass?: LucidModel
  slug: string
  label: string
  pluralLabel: string
  icon?: string
  navigation?: {
    group?: string
    sort?: number
    badge?: (ctx: HttpContext) => unknown | Promise<unknown>
  }
  recordTitle?: string
  globallySearchable?: string[]
  globalSearchDetails?: (record: Model) => string[]
  policy?: PolicyClass | (() => Promise<{ default: PolicyClass }>)
  scope?: false | ((query: ModelQueryBuilderContract<LucidModel>, ctx: HttpContext) => void)
  form?: ComponentDefinition[]
  table?: TableDefinition
  infolist?: ComponentDefinition[]
  actions?: { header: ActionDefinition[]; row: ActionDefinition[]; bulk: ActionDefinition[] }
  pages: Partial<Record<'list' | 'create' | 'edit' | 'view', PageDefinition>>
  hooks: ResourceHooks<Model>
  handlers: ResourceHandlers<Model>
  toJSON(): string
}
