import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { ActionBuilder, ActionDefinition, ResourceActions } from '../definition/action.js'
import type { ComponentDefinition, FormSchema, SchemaComponent } from '../definition/schema.js'
import type {
  RelationGroupDefinition,
  RelationManagerDefinition,
  RelationManagerEntry,
} from '../definition/relation_manager.js'
import type { TableSchema } from '../definition/table.js'
import { stableJson } from '../definition/shared.js'
import { createFormSchema, getComponentDefinition } from './schema/schema.js'
import { Table } from './table/table.js'

export type RelationManagerBuilder = {
  label(value: string): RelationManagerBuilder
  icon(value: string): RelationManagerBuilder
  badge(
    value: (ctx: HttpContext, record: unknown) => unknown | Promise<unknown>
  ): RelationManagerBuilder
  readOnly(value?: boolean): RelationManagerBuilder
  recordTitle(value: string): RelationManagerBuilder
  form(
    callback: (
      schema: FormSchema<Record<string, unknown>>
    ) => { components: ComponentDefinition[] } | readonly SchemaComponent[]
  ): RelationManagerBuilder
  table(callback: (table: TableSchema) => TableSchema): RelationManagerBuilder
  actions(value: ResourceActions): RelationManagerBuilder
  toDefinition(): RelationManagerDefinition
  toJSON(): string
  readonly definition: RelationManagerDefinition
}

function components(
  value: { components?: ComponentDefinition[] } | readonly SchemaComponent[]
): ComponentDefinition[] {
  if (Array.isArray(value)) return (value as readonly SchemaComponent[]).map(getComponentDefinition)
  return (value as { components?: ComponentDefinition[] }).components ?? []
}

class RelationManager implements RelationManagerBuilder {
  constructor(readonly definition: RelationManagerDefinition) {}

  private change(patch: Partial<RelationManagerDefinition>): RelationManagerBuilder {
    const next = { ...this.definition, ...patch }
    return new RelationManager(next)
  }

  label(value: string): RelationManagerBuilder {
    return this.change({ label: value })
  }

  icon(value: string): RelationManagerBuilder {
    return this.change({ icon: value })
  }

  badge(value: NonNullable<RelationManagerDefinition['badge']>): RelationManagerBuilder {
    return this.change({ badge: value })
  }

  readOnly(value = true): RelationManagerBuilder {
    return this.change({ readOnly: value })
  }

  recordTitle(value: string): RelationManagerBuilder {
    return this.change({ recordTitle: value })
  }

  form(
    callback: (
      schema: FormSchema<Record<string, unknown>>
    ) => { components: ComponentDefinition[] } | readonly SchemaComponent[]
  ): RelationManagerBuilder {
    return this.change({ form: components(callback(createFormSchema<Record<string, unknown>>())) })
  }

  table(callback: (table: TableSchema) => TableSchema): RelationManagerBuilder {
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

  actions(value: ResourceActions): RelationManagerBuilder {
    const definitions = (
      items: readonly ActionBuilder[] | undefined,
      context: ActionDefinition['context']
    ) => (items ?? []).map((item) => ({ ...item.definition, context }))
    return this.change({
      actions: {
        header: definitions(value.header, 'header'),
        row: definitions(value.row, 'record'),
        bulk: definitions(value.bulk, 'bulk'),
      },
    })
  }

  toDefinition(): RelationManagerDefinition {
    return this.definition
  }

  toJSON(): string {
    const {
      parentModel,
      relation,
      label,
      icon,
      group,
      table,
      form,
      readOnly,
      recordTitle,
      actions,
    } = this.definition
    return stableJson({
      parentModel,
      relation,
      label,
      ...(icon ? { icon } : {}),
      ...(group ? { group } : {}),
      ...(table ? { table } : {}),
      ...(form ? { form } : {}),
      readOnly,
      ...(recordTitle ? { recordTitle } : {}),
      actions,
    })
  }
}

type ResourceLike = {
  definition?: { modelClass?: LucidModel }
  modelClass?: LucidModel
}
export function defineRelationManager(
  owner: LucidModel | ResourceLike,
  relation: string
): RelationManagerBuilder {
  let model: LucidModel | undefined
  if (typeof owner === 'function') model = owner
  else if (owner.definition?.modelClass) model = owner.definition.modelClass
  else if (owner.modelClass) model = owner.modelClass
  if (!model) throw new TypeError('defineRelationManager expects a Lucid model or Pupitre resource')
  return new RelationManager({
    parentModel: model.name,
    parentModelClass: model,
    relation,
    label: relation.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
    readOnly: false,
    actions: { header: [], row: [], bulk: [] },
  })
}

export function relationGroup(
  label: string,
  relations: readonly RelationManagerEntry[]
): RelationGroupDefinition {
  return {
    kind: 'relationGroup',
    label,
    relations: relations.map((item) =>
      'toDefinition' in item && typeof item.toDefinition === 'function' ? item.toDefinition() : item
    ),
  }
}
