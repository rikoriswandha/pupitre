import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

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
