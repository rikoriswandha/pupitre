import type { ResourceRuntime } from '../manager.js'

function rows(value: unknown): Record<string, unknown>[] {
  const result = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'rows' in value && Array.isArray(value.rows)
      ? value.rows
      : []
  return result.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object'
  )
}

function quoteSqliteIdentifier(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

/** Returns searchable model attributes without an index on the model table. */
export async function missingSearchIndexes(
  resource: ResourceRuntime,
  searchable: string[]
): Promise<string[]> {
  const direct = searchable.filter((column) => !column.includes('.'))
  if (!direct.length) return []
  const indexed = new Set<string>()
  // Lazy: `services/db` awaits app boot at import time, which breaks the ace
  // command manifest generation that imports this module without an app.
  const { default: db } = await import('@adonisjs/lucid/services/db')
  const client = db.connection(resource.model.connection)
  const table = resource.model.table
  if (
    client.dialect.name === 'sqlite3' ||
    client.dialect.name === 'better-sqlite3' ||
    client.dialect.name === 'libsql'
  ) {
    const indexes = rows(
      await client.rawQuery<unknown>(`PRAGMA index_list(${quoteSqliteIdentifier(table)})`).exec()
    )
    for (const index of indexes) {
      if (typeof index.name !== 'string') continue
      const details = rows(
        await client
          .rawQuery<unknown>(`PRAGMA index_info(${quoteSqliteIdentifier(index.name)})`)
          .exec()
      )
      for (const detail of details) if (typeof detail.name === 'string') indexed.add(detail.name)
    }
  } else if (client.dialect.name === 'postgres') {
    const result = await client
      .rawQuery<unknown>(
        'SELECT indexdef FROM pg_indexes WHERE schemaname = current_schema() AND tablename = ?',
        [table]
      )
      .exec()
    for (const entry of rows(result)) {
      if (typeof entry.indexdef !== 'string') continue
      const definition = /\(([^()]*)\)/.exec(entry.indexdef)?.[1]
      for (const column of definition?.split(',') ?? []) {
        const name = column.trim().replaceAll('"', '').split(/\s+/)[0]
        if (name) indexed.add(name)
      }
    }
  }
  return direct.filter((attribute) => {
    const column = resource.model.$getColumn(attribute)?.columnName ?? attribute
    return !indexed.has(column)
  })
}
