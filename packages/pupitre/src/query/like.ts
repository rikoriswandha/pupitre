import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

/** Literal LIKE values: escape the escape character before wildcard characters. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

export function applyLiteralLike(
  query: ModelQueryBuilderContract<LucidModel, LucidRow>,
  attribute: string,
  value: string,
  mode: 'contains' | 'startsWith' | 'endsWith' | 'equals'
): void {
  const column = query.model.$keys.attributesToColumns.get(attribute) ?? attribute
  const escaped = escapeLike(value)
  const pattern = `${mode === 'contains' || mode === 'endsWith' ? '%' : ''}${escaped}${mode === 'contains' || mode === 'startsWith' ? '%' : ''}`
  query.whereRaw("lower(??) like lower(?) escape '\\'", [column, pattern])
}

/** Applies case-insensitive substring matching to one or more model attributes. */
export function applySearchColumns(
  query: ModelQueryBuilderContract<LucidModel, LucidRow>,
  columns: readonly string[],
  value: string,
  model: LucidModel = query.model,
  initialOr = false
): void {
  if (!columns.length) return
  const pattern = `%${value}%`
  columns.forEach((column, index) => {
    const columnName = model.$keys.attributesToColumns.get(column) ?? column
    const or = index > 0 || initialOr
    if (query.client.dialect.name === 'postgres') {
      if (or) query.orWhereILike(columnName, pattern)
      else query.whereILike(columnName, pattern)
    } else {
      const loweredPattern = `%${value.toLocaleLowerCase()}%`
      if (or) query.orWhereRaw('lower(??) like ?', [columnName, loweredPattern])
      else query.whereRaw('lower(??) like ?', [columnName, loweredPattern])
    }
  })
}
