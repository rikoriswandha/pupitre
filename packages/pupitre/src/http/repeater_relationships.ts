import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../manager.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import type {
  RepeaterFieldDefinition,
  SchemaNodeBuilder,
  SchemaNodeDefinition,
} from '../definition/schema.js'
import { getComponentDefinition, schema as schemaFactory } from '../builder/schema/schema.js'
import { walkSchema } from '../definition/walk.js'

type HasManyRelationshipClient = {
  query(): Promise<LucidRow[]>
  create(attributes: Record<string, unknown>): Promise<LucidRow>
}

function repeaterChildren(value: RepeaterFieldDefinition['schema']): SchemaNodeDefinition[] {
  if (typeof value !== 'function') return value ?? []
  const children = value(schemaFactory as never) as unknown as (
    SchemaNodeDefinition | SchemaNodeBuilder
  )[]
  return children.map((child) => {
    const builder = child as SchemaNodeBuilder
    return typeof builder.toDefinition === 'function'
      ? getComponentDefinition(builder)
      : (child as SchemaNodeDefinition)
  })
}

function relationshipRepeaters(nodes: SchemaNodeDefinition[]): RepeaterFieldDefinition[] {
  const fields: RepeaterFieldDefinition[] = []
  walkSchema(
    nodes,
    (node) => {
      if (node.kind === 'repeater' && node.relationship) fields.push(node)
    },
    { repeaterSchema: (node) => repeaterChildren(node.schema) }
  )
  return fields
}

export async function fillRelationshipRepeaters(
  target: ResourceRuntime,
  record: LucidRow,
  data: Record<string, unknown>
) {
  for (const field of relationshipRepeaters(target.definition.form ?? [])) {
    const relationship = field.relationship
    if (!relationship) continue
    await record.load(relationship.name as never)
    const relatedModel = target.model.$getRelation(relationship.name).relatedModel()
    const related = record.$getRelated(relationship.name)
    const rows = Array.isArray(related) ? related : related ? [related] : []
    if (relationship.orderColumn) {
      rows.sort(
        (left, right) =>
          Number(left.$getAttribute(relationship.orderColumn!)) -
          Number(right.$getAttribute(relationship.orderColumn!))
      )
    }
    data[field.name] = rows.map((row) => {
      const key = row.$getAttribute(relatedModel.primaryKey)
      return {
        ...(row.serialize() as Record<string, unknown>),
        _relationKey: key,
        _key: String(key),
      }
    })
  }
}

export function resourceAttributes(
  nodes: SchemaNodeDefinition[],
  data: Record<string, unknown>
): Record<string, unknown> {
  const attributes = { ...data }
  for (const field of relationshipRepeaters(nodes)) delete attributes[field.name]
  return attributes
}

export async function syncRelationshipRepeaters(
  target: ResourceRuntime,
  record: LucidRow,
  data: Record<string, unknown>,
  trx: TransactionClientContract
) {
  for (const field of relationshipRepeaters(target.definition.form ?? [])) {
    const relationship = field.relationship
    const submitted = data[field.name]
    if (!relationship || submitted === undefined) continue
    if (!Array.isArray(submitted)) throw new E_PUPITRE_FORBIDDEN()
    const relation = target.model.$getRelation(relationship.name)
    if (relation.type !== 'hasMany')
      throw new Error(`Repeater relationship "${relationship.name}" must be hasMany`)
    record.useTransaction(trx)
    const related = record.related(
      relationship.name as never
    ) as unknown as HasManyRelationshipClient
    const existing = await related.query()
    const relatedModel = relation.relatedModel()
    const primaryKey = relatedModel.primaryKey
    const existingById = new Map(
      existing.map((row) => [String(row.$getAttribute(primaryKey)), row])
    )
    const retained = new Set<string>()
    for (const [index, value] of submitted.entries()) {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new E_PUPITRE_FORBIDDEN()
      const row = value as Record<string, unknown>
      const id = row._relationKey
      const attributes = { ...row }
      delete attributes._relationKey
      delete attributes._key
      if (relationship.orderColumn) attributes[relationship.orderColumn] = index
      if (id === undefined || id === null || id === '') {
        await related.create(attributes)
        continue
      }
      if ((typeof id !== 'string' && typeof id !== 'number') || retained.has(String(id)))
        throw new E_PUPITRE_FORBIDDEN()
      const child = existingById.get(String(id))
      if (!child) throw new E_PUPITRE_FORBIDDEN()
      retained.add(String(id))
      child.useTransaction(trx)
      await child.merge(attributes as never).save()
    }
    for (const [id, child] of existingById) {
      if (!retained.has(id)) {
        child.useTransaction(trx)
        await child.delete()
      }
    }
  }
}
