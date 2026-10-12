import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { Database } from '@adonisjs/lucid/database'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { SchemaNodeDefinition } from '../definition/schema.js'
import { valuesAt } from '../definition/values_at.js'
import { cleanupReplacedFiles, fileKeys, uploadFields, type FileReferenceField } from './index.js'

/** Unscoped physical reads deliberately include soft-deleted and cross-tenant records. */
export async function referencedFileKeys(
  model: LucidModel,
  field: FileReferenceField,
  keys: ReadonlySet<string>
): Promise<Set<string>> {
  if (!keys.size) return new Set()
  // Relationship repeaters persist in related tables, not the parent JSON column.
  // Retain conservatively until related-record cleanup can prove ownership.
  if (field.relationshipPath) return new Set(keys)
  model.boot()
  const root = field.name.split('.')[0]
  if (!model.$hasColumn(root)) return new Set(keys)
  const column = model.$keys.attributesToColumns.get(root) ?? root
  const database = (await app.container.make('lucid.db')) as Database
  const client = database.connection(model.connection)
  const found = new Set<string>()
  if (field.name === root && !field.multiple) {
    const rows = await client
      .from(model.table)
      .select(column)
      .whereIn(column, [...keys])
    for (const row of rows) found.add(row[column])
    return found
  }
  const primary = model.$keys.attributesToColumns.get(model.primaryKey) ?? model.primaryKey
  let cursor: string | number | undefined
  while (true) {
    const query = client.from(model.table).select(primary, column).whereNotNull(column)
    if (cursor !== undefined) query.where(primary, '>', cursor)
    const rows = await query.orderBy(primary).limit(200)
    for (const row of rows) {
      let value = row[column]
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value)
        } catch {
          /* Scalar keys are already decoded. */
        }
      }
      for (const key of fileKeys(valuesAt({ [root]: value }, field.name))) {
        if (keys.has(key)) found.add(key)
      }
      if (found.size === keys.size) return found
    }
    if (rows.length < 200) return found
    cursor = rows.at(-1)![primary]
  }
}

/** Call only after permanent deletion has committed. Never scopes references by tenant. */
export async function cleanupRecordFiles(
  form: SchemaNodeDefinition[] | undefined,
  records: LucidRow[],
  ctx?: Pick<HttpContext, 'logger'>
): Promise<void> {
  if (!form || !records.length) return
  const model = records[0].constructor as LucidModel
  for (const field of uploadFields(form)) {
    const removed = fileKeys(records.flatMap((record) => valuesAt(record.serialize(), field.name)))
    try {
      for (const key of await referencedFileKeys(model, field, removed)) removed.delete(key)
    } catch (error) {
      const logger = ctx?.logger ?? (await app.container.make('logger'))
      logger.error({ err: error }, 'Pupitre file reference check failed after committed deletion')
      continue
    }
    for (const key of removed) {
      try {
        await cleanupReplacedFiles(field, key, null)
      } catch (error) {
        const logger = ctx?.logger ?? (await app.container.make('logger'))
        logger.error({ err: error, key }, 'Pupitre file cleanup failed after committed deletion')
      }
    }
  }
}
