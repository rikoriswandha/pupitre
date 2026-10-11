import type {
  ActionDescriptor,
  ColumnDescriptor,
  FilterDescriptor,
  JsonRenderSpec,
  TableDescriptor,
} from '../../catalog/wire.js'
import type { PageDefinition } from '../definition/page.js'
import type { TableDefinition, TableColumnDefinition } from '../definition/table.js'

export type ListTabs = NonNullable<PageDefinition['tabs']>

type CompileOptions = {
  url: string
  id: string
  dataProp?: string
  queryPrefix?: string
  tabs?: ListTabs
  bulkActions: ActionDescriptor[]
  emptyStateAction?: ActionDescriptor
  compileFilterForm(
    nodes: NonNullable<Extract<TableDefinition['filters'][number], { kind: 'custom' }>['form']>
  ): Promise<JsonRenderSpec>
}

function label(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function columnProps(column: TableColumnDefinition): Record<string, unknown> {
  switch (column.kind) {
    case 'text':
      return {
        ...(column.badge ? { badge: true } : {}),
        ...(column.limit !== undefined ? { limit: column.limit } : {}),
        ...(column.description ? { hasDescription: true } : {}),
        ...(column.money ? { money: column.money } : {}),
        ...(column.numeric ? { numeric: true } : {}),
        ...(column.dateTime ? { dateTime: true } : {}),
        ...(column.date ? { date: true } : {}),
        ...(column.since ? { since: true } : {}),
        ...(column.copyable ? { copyable: true } : {}),
      }
    case 'image':
      return {
        ...(column.circular ? { circular: true } : {}),
        ...(column.stacked ? { stacked: true } : {}),
      }
    case 'badge':
      return { colors: column.colors ?? {} }
    case 'icon':
      return {
        icons: column.icons ?? {},
        colors: column.colors ?? {},
        boolean: column.boolean ?? false,
      }
    case 'select':
      return { options: filterOptions(column.options) ?? [] }
    case 'textInput':
    case 'toggle':
    case 'checkbox':
      return {}
    case 'color':
      return {}
    case 'custom':
      return { component: column.component }
    case 'fragment':
      return { component: column.component }
    default:
      return {}
  }
}

function descriptorType(kind: TableColumnDefinition['kind']): ColumnDescriptor['type'] {
  if (kind === 'custom') return 'custom'
  return kind
}

function pollMilliseconds(interval: string): number {
  const match = /^(\d+)(ms|s|m)?$/.exec(interval)
  if (!match) throw new Error(`Invalid table polling interval "${interval}"`)
  const amount = Number(match[1])
  return amount * (match[2] === 'ms' ? 1 : match[2] === 'm' ? 60_000 : 1_000)
}

function filterOptions(options: Record<string, unknown> | undefined) {
  if (!options) return undefined
  return Object.entries(options).map(([value, option]) => {
    if (option && typeof option === 'object' && 'label' in option) {
      const record = option as {
        label: unknown
        description?: unknown
        disabled?: unknown
        icon?: unknown
        color?: unknown
      }
      return {
        value,
        label: String(record.label),
        ...(typeof record.description === 'string' ? { description: record.description } : {}),
        ...(typeof record.disabled === 'boolean' ? { disabled: record.disabled } : {}),
        ...(typeof record.icon === 'string' ? { icon: record.icon } : {}),
        ...(typeof record.color === 'string' ? { color: record.color } : {}),
      }
    }
    return { value, label: String(option) }
  })
}

export async function compileTable(
  table: TableDefinition,
  options: CompileOptions
): Promise<TableDescriptor> {
  const columns: ColumnDescriptor[] = table.columns.map((column) => {
    const name = column.kind === 'fragment' ? column.component : column.name
    return {
      name,
      label: column.kind === 'fragment' ? label(name) : (column.label ?? label(name)),
      type: descriptorType(column.kind),
      sortable: column.kind === 'fragment' ? false : (column.sortable ?? false),
      searchable: column.kind === 'fragment' ? false : (column.searchable ?? false),
      ...(column.kind !== 'fragment' && column.individuallySearchable
        ? { individuallySearchable: true }
        : {}),
      ...(column.kind !== 'fragment' && column.summaries ? { summarize: column.summaries } : {}),
      ...('toggleable' in column && column.toggleable
        ? { toggleable: { hiddenByDefault: column.toggleable.hiddenByDefault ?? false } }
        : {}),
      ...('alignment' in column && column.alignment ? { alignment: column.alignment } : {}),
      ...('wrap' in column && column.wrap !== undefined ? { wrap: column.wrap } : {}),
      ...('width' in column && column.width ? { width: column.width } : {}),
      ...('editable' in column && column.editable
        ? { editable: { url: `${options.url}/:id/column/${encodeURIComponent(name)}` } }
        : {}),
      props: columnProps(column),
    }
  })

  const filters: FilterDescriptor[] = []
  for (const filter of table.filters) {
    const form =
      filter.kind === 'custom' && filter.form?.length
        ? { form: { spec: { $raw: await options.compileFilterForm(filter.form) } as never } }
        : {}
    if (filter.kind === 'select') {
      filters.push({
        type: 'select',
        name: filter.name,
        label: label(filter.name),
        options: filterOptions(filter.options),
        ...form,
      })
    } else if (filter.kind === 'ternary') {
      filters.push({ type: 'ternary', name: filter.name, label: label(filter.name), ...form })
    } else if (filter.kind === 'dateRange') {
      filters.push({ type: 'dateRange', name: filter.name, label: label(filter.name), ...form })
    } else if (filter.kind === 'trashed') {
      filters.push({ type: 'trashed', name: filter.name, label: label(filter.name) })
    } else {
      filters.push({ type: 'custom', name: filter.name, label: label(filter.name), ...form })
    }
  }

  const tabs = options.tabs
    ? Object.entries(options.tabs).map(([key, tab]) => ({ key, label: tab.label ?? label(key) }))
    : undefined
  const emptyState = table.emptyState
    ? {
        heading: table.emptyState.heading,
        ...(table.emptyState.description ? { description: table.emptyState.description } : {}),
        ...(table.emptyState.icon ? { icon: table.emptyState.icon } : {}),
        ...(options.emptyStateAction ? { action: options.emptyStateAction } : {}),
      }
    : undefined
  const perPageOptions = table.paginated === false ? [] : [...table.paginated]
  return {
    id: options.id,
    url: options.url,
    ...(options.dataProp ? { dataProp: options.dataProp } : {}),
    ...(options.queryPrefix ? { queryPrefix: options.queryPrefix } : {}),
    columns,
    filters,
    filtersLayout: table.filtersLayout,
    ...(table.groups
      ? {
          groups: table.groups.map((group) => ({
            key: group.key,
            ...(group.collapsible ? { collapsible: true } : {}),
            label: group.label ?? label(group.key),
          })),
        }
      : {}),
    ...(tabs ? { tabs } : {}),
    ...(table.defaultSort
      ? { defaultSort: table.defaultSort }
      : table.reorderable
        ? { defaultSort: { column: table.reorderable, direction: 'asc' as const } }
        : {}),
    perPageOptions,
    searchable: table.columns.some((column) => column.kind !== 'fragment' && column.searchable),
    searchDebounce: table.searchDebounce,
    selectable: options.bulkActions.length > 0,
    striped: table.striped,
    bulkActions: options.bulkActions,
    ...(table.reorderable ? { reorderable: { url: `${options.url}/reorder` } } : {}),
    ...(table.poll ? { poll: pollMilliseconds(table.poll) } : {}),
    ...(table.deferFilters ? { deferFilters: true } : {}),
    ...(table.deferLoading ? { deferLoading: true } : {}),
    ...(emptyState ? { emptyState } : {}),
    layout: table.layout ? 'grid' : 'table',
    ...(table.layout ? { gridColumns: table.layout.columns } : {}),
  }
}
