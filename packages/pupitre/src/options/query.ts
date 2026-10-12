import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { FieldDefinitionUnion } from '../definition/schema.js'
import type { ResourceRuntime } from '../manager.js'
import { relatedScopedQuery } from '../tenancy/related.js'
import { applyGroupedScope } from '../query/grouped_scope.js'
import { applySearchColumns } from '../query/like.js'

export type SelectOption = {
  value: string | number
  label: string
  description?: string
  disabled?: boolean
}
export type OptionQueryResult = { options: SelectOption[]; hasMore: boolean }
type SelectField = Extract<FieldDefinitionUnion, { kind: 'select' | 'multiSelect' }>

function normalizeOptions(value: unknown): SelectOption[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (item && typeof item === 'object' && 'value' in item && 'label' in item) {
        const candidate = item as Record<string, unknown>
        if (
          (typeof candidate.value === 'string' || typeof candidate.value === 'number') &&
          typeof candidate.label === 'string'
        ) {
          return [
            {
              value: candidate.value,
              label: candidate.label,
              ...(typeof candidate.description === 'string'
                ? { description: candidate.description }
                : {}),
              ...(typeof candidate.disabled === 'boolean' ? { disabled: candidate.disabled } : {}),
            },
          ]
        }
      }
      return typeof item === 'string' || typeof item === 'number'
        ? [{ value: item, label: String(item) }]
        : []
    })
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([optionValue, label]) => ({
      value: optionValue,
      label: String(label),
    }))
  }
  return []
}

function optionFromRow(
  row: LucidRow,
  valueAttribute: string,
  labelAttribute: string
): SelectOption {
  const value = row.$getAttribute(valueAttribute)
  return {
    value: typeof value === 'string' || typeof value === 'number' ? value : String(value),
    label: String(row.$getAttribute(labelAttribute) ?? ''),
  }
}

export async function queryOptions(args: {
  ctx: HttpContext
  owner?: ResourceRuntime
  field: SelectField
  search?: string
  selected?: unknown[]
  page?: number
  selectedOnly?: boolean
}): Promise<OptionQueryResult> {
  const { ctx, owner, field } = args
  const page = Math.max(1, args.page ?? 1)
  const search = (args.search ?? '').trim()
  const selected = args.selected ?? []
  const relationship = field.relationship

  if (typeof field.options === 'function') {
    const values = selected.filter(
      (value): value is string | number => typeof value === 'string' || typeof value === 'number'
    )
    const output = normalizeOptions(await field.options({ search, ctx, page, values }))
    const selectedOptions = output.filter((option) =>
      selected.some((value) => String(value) === String(option.value))
    )
    if (field.getOptionLabelUsing) {
      for (const value of selected) {
        if (
          (typeof value !== 'string' && typeof value !== 'number') ||
          selectedOptions.some((option) => String(option.value) === String(value))
        ) {
          continue
        }
        const label = await field.getOptionLabelUsing(value, ctx)
        selectedOptions.push({ value, label: String(label ?? value) })
      }
    }
    if (args.selectedOnly) return { options: selectedOptions, hasMore: false }
    const filtered = output.filter((option) => !selectedOptions.includes(option))
    const offset = (page - 1) * 20
    return {
      options: [...selectedOptions, ...filtered.slice(offset, offset + 20)],
      hasMore: filtered.length > offset + 20,
    }
  }

  if (!relationship || !owner) return { options: normalizeOptions(field.options), hasMore: false }
  let model: LucidModel
  try {
    model = owner.model.$getRelation(relationship.name).relatedModel() as LucidModel
  } catch {
    return { options: [], hasMore: false }
  }

  const primaryKey = model.primaryKey
  const labelColumn =
    model.$keys.attributesToColumns.get(relationship.titleColumn) ?? relationship.titleColumn
  const selectedValues = selected.filter(
    (value): value is string | number => typeof value === 'string' || typeof value === 'number'
  )
  const selectedOptions: SelectOption[] = []
  if (selectedValues.length) {
    const { query: selectedQuery } = await relatedScopedQuery(ctx, model)
    selectedQuery.whereIn(primaryKey, selectedValues)
    if (relationship.scope)
      applyGroupedScope(selectedQuery, (builder) => relationship.scope!(builder, ctx))
    const rows = await selectedQuery
    for (const row of rows)
      selectedOptions.push(optionFromRow(row, primaryKey, relationship.titleColumn))
  }
  if (args.selectedOnly) return { options: selectedOptions, hasMore: false }

  const { query: searchQuery } = await relatedScopedQuery(ctx, model)
  if (relationship.scope)
    applyGroupedScope(searchQuery, (builder) => relationship.scope!(builder, ctx))
  if (search && field.searchable !== false) {
    const searchColumns = Array.isArray(field.searchable)
      ? field.searchable
      : [relationship.titleColumn]
    if (searchColumns.length) {
      searchQuery.where((query) => applySearchColumns(query, searchColumns, search, model))
    }
  }
  if (selectedValues.length) searchQuery.whereNotIn(primaryKey, selectedValues)
  const rows = await searchQuery
    .orderBy(labelColumn)
    .limit(21)
    .offset((page - 1) * 20)
  return {
    options: [
      ...selectedOptions,
      ...rows.slice(0, 20).map((row) => optionFromRow(row, primaryKey, relationship.titleColumn)),
    ],
    hasMore: rows.length > 20,
  }
}
