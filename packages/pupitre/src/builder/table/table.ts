import type { TableViewBuilder } from '../../definition/table_view.js'
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
  ToggleColumnBuilder,
  CheckboxColumnBuilder,
  SelectColumnBuilder,
  TextInputColumnBuilder,
  TableFilterDefinition,
  TableFilterBuilderUnion,
  SelectFilterBuilder,
  TernaryFilterBuilder,
  DateRangeFilterBuilder,
  CustomFilterBuilder,
  TrashedFilterBuilder,
  TableDefinition,
  TableSchema,
  QueryCallback,
  TableGroupBuilder,
  QueryBuilderFilterBuilder,
  QueryConstraintBuilder,
  QueryConstraintDefinition,
} from '../../definition/table.js'
import type { TableEmptyStateInput } from '../../definition/table.js'
import type { SchemaNodeBuilder } from '../../definition/schema.js'

type FluentDefinition = TableColumnDefinition | TableFilterDefinition
const columnMethods: Record<TableColumnDefinition['kind'], readonly string[]> = {
  text: [
    'searchable',
    'summarize',
    'sortable',
    'limit',
    'wrap',
    'description',
    'badge',
    'money',
    'numeric',
    'compact',
    'dateTime',
    'date',
    'since',
    'copyable',
    'url',
    'timezone',
    'label',
    'alignment',
    'width',
    'toggleable',
    'options',
  ],
  badge: [
    'searchable',
    'sortable',
    'label',
    'alignment',
    'width',
    'toggleable',
    'colors',
    'options',
  ],
  icon: ['label', 'alignment', 'width', 'toggleable', 'icons', 'colors', 'boolean'],
  image: ['label', 'width', 'toggleable', 'circular', 'stacked'],
  color: ['label', 'alignment', 'width', 'toggleable'],
  custom: ['label', 'width'],
  fragment: [],
  toggle: [
    'label',
    'alignment',
    'width',
    'toggleable',
    'disabled',
    'sortable',
    'searchable',
    'summarize',
  ],
  checkbox: [
    'label',
    'alignment',
    'width',
    'toggleable',
    'disabled',
    'sortable',
    'searchable',
    'summarize',
  ],
  select: [
    'label',
    'alignment',
    'width',
    'toggleable',
    'disabled',
    'options',
    'sortable',
    'searchable',
    'summarize',
  ],
  textInput: [
    'label',
    'alignment',
    'width',
    'toggleable',
    'disabled',
    'validation',
    'sortable',
    'searchable',
    'summarize',
  ],
}
const filterMethods: Record<TableFilterDefinition['kind'], readonly string[]> = {
  select: ['options', 'multiple', 'attribute'],
  ternary: ['trueLabel', 'falseLabel', 'attribute'],
  dateRange: ['attribute', 'timezone'],
  trashed: [],
  custom: ['form', 'query'],
  queryBuilder: ['constraints', 'label'],
}
function immutableFluent(definition: FluentDefinition, allowed: readonly string[]): object {
  const target = { definition, toDefinition: () => definition }
  return new Proxy(target, {
    get(current, property) {
      if (property === 'definition') return current.definition
      if (property === 'toDefinition') return current.toDefinition
      if (typeof property !== 'string' || !allowed.includes(property)) return undefined
      return (...args: unknown[]) => {
        const input = args[0]
        if (property === 'searchable' && input && typeof input === 'object') {
          const searchOptions = input as { individually?: boolean }
          return immutableFluent(
            {
              ...current.definition,
              searchable: true,
              individuallySearchable: searchOptions.individually === true,
            } as FluentDefinition,
            allowed
          )
        }
        if (property === 'summarize' && Array.isArray(input)) {
          return immutableFluent(
            { ...current.definition, summaries: [...input] } as FluentDefinition,
            allowed
          )
        }
        const value =
          input === undefined &&
          [
            'searchable',
            'sortable',
            'wrap',
            'badge',
            'numeric',
            'compact',
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
            : input
        if (property === 'constraints' && Array.isArray(value)) {
          return immutableFluent(
            {
              ...current.definition,
              constraints: value.map((item: QueryConstraintBuilder) => item.toDefinition()),
            } as FluentDefinition,
            allowed
          )
        }
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
function groupBuilder(definition: {
  key: string
  label?: string
  collapsible?: boolean
}): TableGroupBuilder {
  return {
    definition,
    label(value) {
      return groupBuilder({ ...definition, label: value })
    },
    collapsible(value = true) {
      return groupBuilder({ ...definition, collapsible: value })
    },
    toDefinition: () => definition,
  }
}
function makeColumn(kind: 'text', name: string): TextColumnBuilder
function makeColumn(kind: 'badge', name: string): BadgeColumnBuilder
function makeColumn(kind: 'icon', name: string): IconColumnBuilder
function makeColumn(kind: 'image', name: string): ImageColumnBuilder
function makeColumn(kind: 'color', name: string): ColorColumnBuilder
function makeColumn(kind: 'custom', name: string, component: string): CustomColumnBuilder
function makeColumn(kind: 'fragment', component: string): FragmentColumnBuilder
function makeColumn(kind: 'toggle', name: string): ToggleColumnBuilder
function makeColumn(kind: 'checkbox', name: string): CheckboxColumnBuilder
function makeColumn(kind: 'select', name: string): SelectColumnBuilder
function makeColumn(kind: 'textInput', name: string): TextInputColumnBuilder
function makeColumn(
  kind: TableColumnDefinition['kind'],
  name: string,
  component?: string
): TableColumnBuilderUnion {
  const definition = {
    kind,
    ...(kind === 'fragment' ? { component: name } : { name }),
    ...(component ? { component } : {}),
    ...(['toggle', 'checkbox', 'select', 'textInput'].includes(kind) ? { editable: true } : {}),
  } as TableColumnDefinition
  return immutableFluent(definition, columnMethods[kind]) as TableColumnBuilderUnion
}
function makeFilter(kind: 'select', name: string): SelectFilterBuilder
function makeFilter(kind: 'ternary', name: string): TernaryFilterBuilder
function makeFilter(kind: 'dateRange', name: string): DateRangeFilterBuilder
function makeFilter(kind: 'trashed', name: 'trashed'): TrashedFilterBuilder
function makeFilter(kind: 'custom', name: string): CustomFilterBuilder
function makeFilter(kind: 'queryBuilder', name: string): QueryBuilderFilterBuilder
function makeFilter(kind: TableFilterDefinition['kind'], name: string): TableFilterBuilderUnion {
  const definition = {
    kind,
    name,
    ...(kind === 'queryBuilder' ? { constraints: [] } : {}),
  } as TableFilterDefinition
  return immutableFluent(definition, filterMethods[kind]) as TableFilterBuilderUnion
}
class Table implements TableSchema {
  constructor(readonly value: TableDefinition) {}
  records(value: NonNullable<TableDefinition['records']>): this {
    return this.update({ records: value })
  }
  recordKey(value: string): this {
    return this.update({ recordKey: value })
  }
  resolveRecord(value: NonNullable<TableDefinition['resolveRecord']>): this {
    return this.update({ resolveRecord: value })
  }
  actions(value: Parameters<TableSchema['actions']>[0]): this {
    return this.update({
      actions: {
        row: value.row?.map((item) => item.definition),
        header: value.header?.map((item) => item.definition),
        bulk: value.bulk?.map((item) => item.definition),
      },
    })
  }
  private update(patch: Partial<TableDefinition>): this {
    return new Table({ ...this.value, ...patch }) as this
  }
  savedViews(value = true): this {
    return this.update({ savedViews: value })
  }
  presetViews(value: readonly TableViewBuilder[]): this {
    return this.update({ presetViews: value.map((view) => view.toDefinition()) })
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
  defaultSort(column: string, direction: 'asc' | 'desc'): this
  defaultSort(columns: readonly { column: string; direction: 'asc' | 'desc' }[]): this
  defaultSort(
    column: string | readonly { column: string; direction: 'asc' | 'desc' }[],
    direction: 'asc' | 'desc' = 'asc'
  ): this {
    const sorts = typeof column === 'string' ? [{ column, direction }] : [...column]
    return this.update({
      defaultSort: sorts[0],
      defaultSorts: typeof column === 'string' ? undefined : sorts,
    })
  }
  multiSort(max = 3): this {
    if (!Number.isInteger(max) || max < 1 || max > 10)
      throw new Error('multiSort max must be between 1 and 10')
    return this.update({ multiSort: max })
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
  rowClass(value: NonNullable<TableDefinition['rowClass']>): this {
    return this.update({ rowClass: value })
  }
  groups(value: readonly TableGroupBuilder[]): this {
    return this.update({ groups: value.map((group) => group.toDefinition()) })
  }
  defaultGroup(value?: string): this {
    const key = value ?? this.value.groups?.[0]?.key
    return this.update({ defaultGroup: key })
  }
  deferLoading(value = true): this {
    return this.update({ deferLoading: value })
  }
  summarize(
    column: string,
    summaries: readonly ('sum' | 'avg' | 'count' | 'min' | 'max' | 'range')[]
  ): this {
    return this.update({
      columns: this.value.columns.map((item) =>
        item.kind !== 'fragment' && item.name === column
          ? { ...item, summaries: [...summaries] }
          : item
      ),
    })
  }
  count(relation: string): TableColumnBuilderUnion {
    const name = `${relation}_count`
    return immutableFluent(
      { kind: 'text', name, countRelation: relation, numeric: true } as TableColumnDefinition,
      columnMethods.text
    ) as TableColumnBuilderUnion
  }
  recordUrl(value: NonNullable<TableDefinition['recordUrl']> | false): this {
    return this.update({ recordUrl: value })
  }
  emptyState(value: TableEmptyStateInput): this {
    const action =
      value.action && 'definition' in value.action ? value.action.definition : value.action
    return this.update({ emptyState: { ...value, action } })
  }
  reorderable(column: string): this {
    return this.update({ reorderable: column })
  }
  poll(interval: string): this {
    return this.update({ poll: interval })
  }
  deferFilters(value = true): this {
    return this.update({ deferFilters: value })
  }
  layout: { grid(columns: { default?: number; md?: number; xl?: number }): Table } = {
    grid: (columns) => this.update({ layout: { type: 'grid', columns } }),
  }
  toDefinition(): TableDefinition {
    if (this.value.records) {
      const lucidOnly =
        this.value.savedViews ||
        this.value.presetViews?.length ||
        this.value.query ||
        this.value.groups?.length ||
        this.value.defaultGroup ||
        this.value.reorderable ||
        this.value.columns.some(
          (column) =>
            column.kind !== 'fragment' &&
            (column.name.includes('.') ||
              column.summaries?.length ||
              column.countRelation ||
              ('editable' in column && column.editable))
        ) ||
        this.value.filters.some(
          (filter) =>
            filter.kind === 'queryBuilder' ||
            filter.kind === 'trashed' ||
            (filter.kind === 'custom' && filter.query)
        )
      const actions = Object.values(this.value.actions ?? {}).flatMap((items) => items ?? [])
      if (lucidOnly || actions.some((item) => item.builtin))
        throw new Error(
          'Custom-data tables cannot use Lucid-only features (query, relations, summaries, groups, reorderable, inline editing, query-builder filters, or builtin/export actions)'
        )
      if (
        (this.value.actions?.row?.length || this.value.actions?.bulk?.length) &&
        !this.value.resolveRecord
      )
        throw new Error('Custom-data table row/bulk actions require resolveRecord()')
    }
    const defaults = this.value.defaultSorts ?? []
    if (defaults.length > (this.value.multiSort ?? 1))
      throw new Error('Default sorting exceeds the table multiSort limit')
    if (new Set(defaults.map((sort) => sort.column)).size !== defaults.length)
      throw new Error('Default sorting cannot repeat a column')
    return this.value
  }
  group(key: string): TableGroupBuilder {
    return groupBuilder({ key })
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
  toggle: (name: string) => makeColumn('toggle', name),
  checkbox: (name: string) => makeColumn('checkbox', name),
  select: (name: string) => makeColumn('select', name),
  textInput: (name: string) => makeColumn('textInput', name),
  filter: {
    select: (name: string) => makeFilter('select', name),
    ternary: (name: string) => makeFilter('ternary', name),
    dateRange: (name: string) => makeFilter('dateRange', name),
    custom: (name: string) => makeFilter('custom', name),
    queryBuilder: (name = 'query') => makeFilter('queryBuilder', name),
    trashed: () => makeFilter('trashed', 'trashed'),
  },
}

function constraint(definition: QueryConstraintDefinition): QueryConstraintBuilder {
  return {
    definition,
    toDefinition: () => definition,
    label: (value) => constraint({ ...definition, label: value }),
    attribute: (value) => constraint({ ...definition, attribute: value }),
    options: (value) => constraint({ ...definition, options: { ...value } }),
    timezone: (value) => constraint({ ...definition, timezone: value }),
    integer: () => constraint({ ...definition, integer: true }),
  }
}
export const qb = {
  text: (name: string) => constraint({ type: 'text', name }),
  number: (name: string) => constraint({ type: 'number', name }),
  date: (name: string) => constraint({ type: 'date', name }),
  boolean: (name: string) => constraint({ type: 'boolean', name }),
  select: (name: string) => constraint({ type: 'select', name }),
  relationship: (name: string, relatedAttribute: string) =>
    constraint({ type: 'relationship', name, relatedAttribute }),
}
export { Table }
