import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { ActionDefinition } from './action.js'
import type { ComponentDefinition } from './schema.js'
import type { TableDefinition } from './table.js'

export type RelationActions = {
  header: ActionDefinition[]
  row: ActionDefinition[]
  bulk: ActionDefinition[]
}

export type RelationManagerDefinition = {
  parentModel: string
  parentModelClass: LucidModel
  relation: string
  label: string
  icon?: string
  group?: string
  badge?: (ctx: HttpContext, record: unknown) => unknown | Promise<unknown>
  table?: TableDefinition
  form?: ComponentDefinition[]
  readOnly: boolean
  recordTitle?: string
  actions: RelationActions
}

export type RelationGroupDefinition = {
  kind: 'relationGroup'
  label: string
  relations: RelationManagerEntry[]
}

export type RelationManagerEntry =
  | RelationManagerDefinition
  | RelationGroupDefinition
  | { toDefinition(): RelationManagerDefinition }
export function flattenRelationManagers(
  entries: readonly RelationManagerEntry[] = []
): RelationManagerDefinition[] {
  const result: RelationManagerDefinition[] = []
  for (const item of entries) {
    if ('kind' in item) {
      result.push(
        ...flattenRelationManagers(item.relations).map((manager) => ({
          ...manager,
          group: [item.label, manager.group].filter(Boolean).join(' / '),
        }))
      )
    } else if ('toDefinition' in item) {
      result.push(item.toDefinition())
    } else {
      result.push(item)
    }
  }
  return result
}
