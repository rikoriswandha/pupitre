import type {
  TableColumnDefinition,
  TableColumnBuilderUnion,
  TextColumnBuilder,
  BadgeColumnBuilder,
  IconColumnBuilder,
  ImageColumnBuilder,
  ColorColumnBuilder,
  CustomColumnBuilder,
  FragmentColumnBuilder,
  TableFilterDefinition,
  TableFilterBuilderUnion,
  SelectFilterBuilder,
  TernaryFilterBuilder,
  DateRangeFilterBuilder,
  CustomFilterBuilder,
  TableDefinition,
  TableSchema,
  QueryCallback,
} from '../../definition/table.js'
import type { TableEmptyStateInput } from '../../definition/table.js'
import type { SchemaNodeBuilder } from '../../definition/schema.js'

type FluentDefinition = TableColumnDefinition | TableFilterDefinition
const columnMethods: Record<TableColumnDefinition['kind'], readonly string[]> = {
  text: [
    'searchable',
    'sortable',
    'limit',
    'wrap',
    'description',
    'badge',
    'money',
    'numeric',
    'dateTime',
    'date',
    'since',
    'copyable',
    'url',
    'label',
    'alignment',
    'width',
    'toggleable',
  ],
  badge: ['searchable', 'sortable', 'label', 'alignment', 'width', 'toggleable', 'colors'],
  icon: ['label', 'alignment', 'width', 'toggleable', 'icons', 'colors', 'boolean'],
  image: ['label', 'width', 'toggleable', 'circular', 'stacked'],
  color: ['label', 'alignment', 'width', 'toggleable'],
  custom: ['label', 'width'],
  fragment: [],
}
const filterMethods: Record<TableFilterDefinition['kind'], readonly string[]> = {
  select: ['options', 'multiple', 'attribute'],
  ternary: ['trueLabel', 'falseLabel', 'attribute'],
  dateRange: ['attribute'],
  custom: ['form', 'query'],
}
function immutableFluent(definition: FluentDefinition, allowed: readonly string[]): object {
  const target = { definition, toDefinition: () => definition }
  return new Proxy(target, {
    get(current, property) {
      if (property === 'definition') return current.definition
      if (property === 'toDefinition') return current.toDefinition
      if (typeof property !== 'string' || !allowed.includes(property)) return undefined
      return (...args: unknown[]) => {
        const value =
          args[0] === undefined &&
          [
            'searchable',
            'sortable',
            'wrap',
            'badge',
            'numeric',
            'dateTime',
            'date',
            'since',
            'copyable',
            'toggleable',
            'boolean',
            'circular',
            'stacked',
            'multiple',
          ].includes(property)
            ? true
            : args[0]
        if (property === 'form' && Array.isArray(value)) {
          const form = (value as readonly SchemaNodeBuilder[]).map((field) => field.toDefinition())
          return immutableFluent({ ...current.definition, form } as FluentDefinition, allowed)
        }
        return immutableFluent(
          { ...current.definition, [property]: value } as FluentDefinition,
          allowed
        )
      }
    },
  })
}
function makeColumn(kind: 'text', name: string): TextColumnBuilder
function makeColumn(kind: 'badge', name: string): BadgeColumnBuilder
function makeColumn(kind: 'icon', name: string): IconColumnBuilder
function makeColumn(kind: 'image', name: string): ImageColumnBuilder
function makeColumn(kind: 'color', name: string): ColorColumnBuilder
function makeColumn(kind: 'custom', name: string, component: string): CustomColumnBuilder
function makeColumn(kind: 'fragment', component: string): FragmentColumnBuilder
function makeColumn(
  kind: TableColumnDefinition['kind'],
  name: string,
  component?: string
): TableColumnBuilderUnion {
  const definition = {
    kind,
    ...(kind === 'fragment' ? { component: name } : { name }),
    ...(component ? { component } : {}),
  } as TableColumnDefinition
  return immutableFluent(definition, columnMethods[kind]) as TableColumnBuilderUnion
}
function makeFilter(kind: 'select', name: string): SelectFilterBuilder
function makeFilter(kind: 'ternary', name: string): TernaryFilterBuilder
function makeFilter(kind: 'dateRange', name: string): DateRangeFilterBuilder
function makeFilter(kind: 'custom', name: string): CustomFilterBuilder
function makeFilter(kind: TableFilterDefinition['kind'], name: string): TableFilterBuilderUnion {
  const definition = { kind, name } as TableFilterDefinition
  return immutableFluent(definition, filterMethods[kind]) as TableFilterBuilderUnion
}
class Table implements TableSchema {
  constructor(readonly value: TableDefinition) {}
  private update(patch: Partial<TableDefinition>): this {
    return new Table({ ...this.value, ...patch }) as this
  }
  columns(value: readonly TableColumnBuilderUnion[]): this {
    return this.update({ columns: value.map((item) => item.toDefinition()) })
  }
  filters(value: readonly TableFilterBuilderUnion[]): this {
    return this.update({ filters: value.map((item) => item.toDefinition()) })
  }
  query(value: QueryCallback): this {
    return this.update({ query: value })
  }
  defaultSort(column: string, direction: 'asc' | 'desc'): this {
    return this.update({ defaultSort: { column, direction } })
  }
  filtersLayout(value: TableDefinition['filtersLayout']): this {
    return this.update({ filtersLayout: value })
  }
  searchDebounce(value: number): this {
    return this.update({ searchDebounce: value })
  }
  paginated(value: TableDefinition['paginated']): this {
    return this.update({ paginated: value })
  }
  striped(value = true): this {
    return this.update({ striped: value })
  }
  recordUrl(value: NonNullable<TableDefinition['recordUrl']> | false): this {
    return this.update({ recordUrl: value })
  }
  emptyState(value: TableEmptyStateInput): this {
    const action =
      value.action && 'definition' in value.action ? value.action.definition : value.action
    return this.update({ emptyState: { ...value, action } })
  }
  toDefinition(): TableDefinition {
    return this.value
  }
}
export const table = {
  text: (name: string) => makeColumn('text', name),
  badge: (name: string) => makeColumn('badge', name),
  icon: (name: string) => makeColumn('icon', name),
  image: (name: string) => makeColumn('image', name),
  color: (name: string) => makeColumn('color', name),
  custom: (name: string, component: string) => makeColumn('custom', name, component),
  fragment: (component: string) => makeColumn('fragment', component),
  filter: {
    select: (name: string) => makeFilter('select', name),
    ternary: (name: string) => makeFilter('ternary', name),
    dateRange: (name: string) => makeFilter('dateRange', name),
    custom: (name: string) => makeFilter('custom', name),
  },
}
export { Table }
