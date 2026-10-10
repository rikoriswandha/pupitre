import { createElement, useRef } from 'react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import type {
  ColumnDescriptor,
  JsonRenderSpec,
  TableData,
  TableDescriptor,
  TableRow,
} from '@rikology/pupitre/catalog'
import { useRunAction, useTable } from '@rikology/pupitre-react'
import { SpecRenderer } from '@rikology/pupitre-react'

export type DataTableProps = {
  props: { descriptor: TableDescriptor; label?: string | null; disabled?: boolean }
  children?: ReactNode
  emit: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

function isSubSpec(value: unknown): value is JsonRenderSpec {
  return (
    value !== null &&
    typeof value === 'object' &&
    'root' in value &&
    typeof value.root === 'string' &&
    'elements' in value &&
    value.elements !== null &&
    typeof value.elements === 'object'
  )
}

function DataTableCell({ value, column }: { value: unknown; column: ColumnDescriptor }) {
  const cell =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined
  const raw = cell && 'value' in cell ? cell.value : value
  if ((column.type === 'custom' || column.type === 'fragment') && isSubSpec(raw))
    return createElement(SpecRenderer, { spec: raw })
  return renderCellValue(value, column)
}

function seededFilterState(
  spec: JsonRenderSpec,
  name: string,
  query: Record<string, unknown>
): Record<string, unknown> {
  const state = structuredClone(spec.state ?? {}) as Record<string, unknown>
  const data =
    state.data && typeof state.data === 'object' && !Array.isArray(state.data)
      ? { ...(state.data as Record<string, unknown>) }
      : {}
  const params: Record<string, unknown> = Object.fromEntries(
    new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).entries()
  )
  const current = { ...params, ...query }
  const prefix = `filters[${name}]`
  const direct = current[prefix]
  if (direct !== undefined && direct !== null) {
    const field = Object.keys(data)[0]
    state.data = field ? { ...data, [field]: direct } : direct
    return state
  }
  for (const [key, value] of Object.entries(current)) {
    if (key.startsWith(`${prefix}[`)) data[key.slice(prefix.length + 1, -1)] = value
  }
  if (Object.keys(data).length) state.data = data
  return state
}

function CustomFilterForm({
  filter,
  spec,
  setFilter,
  query,
}: {
  filter: TableDescriptor['filters'][number]
  spec: JsonRenderSpec
  setFilter: (name: string, value: unknown) => void
  query: Record<string, unknown>
}) {
  const seededState = seededFilterState(spec, filter.name, query)
  const seedKey = JSON.stringify(seededState.data ?? null)
  // Edits stay local until Apply (or Enter in the embedded form): no visit per keystroke.
  const [draft, setDraft] = useState<{ seedKey: string; data: unknown } | null>(null)
  const data = draft?.seedKey === seedKey ? draft.data : seededState.data
  const apply = () => {
    setFilter(filter.name, data && typeof data === 'object' ? data : (data ?? ''))
  }
  return (
    <div className="min-w-36 space-y-2">
      <span className="text-sm">{filter.label}</span>
      {createElement(SpecRenderer, {
        // Re-seed from the URL when the applied filter changes (back/forward, reset).
        key: seedKey,
        spec: { ...spec, state: seededState },
        state: seededState,
        embeddedSubmit: apply,
        onStateChange: (state) => setDraft({ seedKey, data: state.data }),
      })}
      <button type="button" className="rounded border px-3 py-1 text-sm" onClick={apply}>
        Apply
      </button>
    </div>
  )
}

function CustomFilter(props: {
  filter: TableDescriptor['filters'][number]
  setFilter: (name: string, value: unknown) => void
  query: Record<string, unknown>
}) {
  const spec = props.filter.form?.spec
  return spec ? <CustomFilterForm {...props} spec={spec as JsonRenderSpec} /> : null
}
function renderCellValue(value: unknown, column: ColumnDescriptor): ReactNode {
  const cell =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined
  const raw = cell && 'value' in cell ? cell.value : value
  const text = displayValue(cell?.label ?? raw)
  const description = cell?.description ?? column.props.description
  const url = cell?.url ?? cell?.href ?? column.props.url
  const colors =
    column.props.colors && typeof column.props.colors === 'object'
      ? (column.props.colors as Record<string, string>)
      : undefined

  if (column.type === 'image') {
    const images = Array.isArray(raw) ? raw : [raw]
    return (
      <span className={`inline-flex items-center ${column.props.stacked ? '-space-x-3' : 'gap-2'}`}>
        {images.map((image, index) => {
          const source =
            typeof image === 'string'
              ? image
              : image && typeof image === 'object' && 'url' in image
                ? String(image.url)
                : ''
          if (!source) return null
          return (
            <img
              key={`${source}-${index}`}
              className={`h-10 w-10 border-2 border-background object-cover ${column.props.circular ? 'rounded-full' : 'rounded'}`}
              src={source}
              alt={String(column.props.alt ?? column.label)}
            />
          )
        })}
      </span>
    )
  }
  if (column.type === 'color')
    return typeof raw === 'string' && raw ? (
      <span className="inline-flex items-center gap-2">
        <span className="h-4 w-4 rounded border" style={{ backgroundColor: raw }} />
        {text}
      </span>
    ) : null
  if (column.type === 'badge' || (column.type === 'text' && column.props.badge))
    return (
      <span
        className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: colors?.[text] }}
      >
        {text}
      </span>
    )
  if (column.type === 'toggle')
    return (
      <span
        aria-label={raw ? 'Enabled' : 'Disabled'}
        className={raw ? 'text-primary' : 'text-muted-foreground'}
      >
        {raw ? 'On' : 'Off'}
      </span>
    )
  if (column.type === 'icon') {
    const icons =
      column.props.icons && typeof column.props.icons === 'object'
        ? (column.props.icons as Record<string, string>)
        : undefined
    return (
      <span aria-label={text} title={text}>
        {icons?.[text] ?? text}
      </span>
    )
  }
  if (column.type === 'select') {
    const options = column.props.options
    const option = Array.isArray(options)
      ? (options.find(
          (item) =>
            item && typeof item === 'object' && 'value' in item && String(item.value) === text
        ) as { label?: unknown } | undefined)
      : undefined
    return displayValue(option?.label ?? raw)
  }

  const limit = typeof column.props.limit === 'number' ? column.props.limit : undefined
  const truncated = limit !== undefined && text.length > limit ? `${text.slice(0, limit)}…` : text
  const content =
    typeof url === 'string' && url ? (
      <a className="text-primary hover:underline" href={url}>
        {truncated}
      </a>
    ) : (
      <span
        title={limit !== undefined && text.length > limit ? text : undefined}
        className={column.props.wrap ? 'whitespace-normal' : 'whitespace-nowrap'}
      >
        {truncated}
      </span>
    )
  if (column.type === 'custom' || column.type === 'fragment')
    return (
      <span data-custom-component={String(column.props.component ?? '')}>
        {text || 'Custom column content'}
      </span>
    )
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {content}
      {typeof description === 'string' && description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
      {column.props.copyable === true && text && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => {
            if (typeof navigator !== 'undefined') void navigator.clipboard?.writeText(text)
          }}
        >
          Copy
        </button>
      )}
    </span>
  )
}

export function DataTable({ props, children, emit, loading = false }: DataTableProps) {
  const descriptor = props.descriptor as TableDescriptor & { striped?: boolean }
  const tableState = useTable(descriptor)
  const runAction = useRunAction()
  const tableData =
    tableState.data && 'rows' in tableState.data ? (tableState.data as TableData) : undefined
  const rows = tableData?.rows ?? []
  const [search, setSearch] = useState(
    typeof tableState.query.q === 'string' ? tableState.query.q : ''
  )
  const [draggedKey, setDraggedKey] = useState<string | number | null>(null)

  const querySearch = tableState.query.q
  const searchTable = tableState.search
  const lastSubmittedSearch = useRef(String(querySearch ?? ''))
  useEffect(() => {
    const value = typeof querySearch === 'string' ? querySearch : ''
    setSearch(value)
    lastSubmittedSearch.current = value
  }, [querySearch])
  useEffect(() => {
    if (
      !descriptor.searchable ||
      search === (querySearch ?? '') ||
      search === lastSubmittedSearch.current
    )
      return
    const timer = window.setTimeout(
      () => {
        lastSubmittedSearch.current = search
        searchTable(search)
      },
      Math.max(0, descriptor.searchDebounce)
    )
    return () => window.clearTimeout(timer)
  }, [descriptor.searchable, descriptor.searchDebounce, search, querySearch, searchTable])

  const columns: ColumnDef<TableRow>[] = descriptor.columns.map((column) => ({
    id: column.name,
    accessorFn: (row) => row.cells[column.name],
    header: column.label,
    enableSorting: column.sortable,
    enableHiding: Boolean(column.toggleable),
    cell: ({ getValue }) => <DataTableCell value={getValue<unknown>()} column={column} />,
  }))
  // TanStack returns a mutable table instance; this render path uses its documented APIs directly.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table exposes a mutable instance for its documented rendering APIs.
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: Object.fromEntries(
        descriptor.columns
          .filter((column) => column.toggleable?.hiddenByDefault)
          .map((column) => [column.name, false])
      ),
    },
  })
  const meta = tableData?.meta
  const selected = tableState.selected
  const selectableRows = rows.filter((row) => row.selectable)
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selected.includes(row.key))
  const page = meta?.currentPage ?? 1
  const lastPage = meta?.lastPage ?? 1
  const columnsVisible = descriptor.columns.some((column) => column.toggleable)

  function selectRow(key: string | number, checked: boolean) {
    tableState.setSelected(
      checked ? [...new Set([...selected, key])] : selected.filter((existing) => existing !== key)
    )
  }
  function changeSort(column: string) {
    tableState.sort(column)
    emit('column', { column })
  }
  function reorderRow(target: TableRow) {
    if (
      !descriptor.reorderable ||
      draggedKey === null ||
      draggedKey === undefined ||
      draggedKey === target.key
    )
      return
    const order = rows.map((row) => row.key)
    const from = order.indexOf(draggedKey)
    const to = order.indexOf(target.key)
    if (from < 0 || to < 0) return
    order.splice(from, 1)
    order.splice(to, 0, draggedKey)
    emit('reorder', { ids: order, url: descriptor.reorderable.url })
    setDraggedKey(null)
  }
  function renderActions(row: TableRow) {
    const groups = new Map<string, typeof row.actions>()
    const ungrouped = row.actions.filter((action) => action.enabled && !action.group)
    for (const action of row.actions) {
      if (!action.enabled || !action.group) continue
      groups.set(action.group, [...(groups.get(action.group) ?? []), action])
    }
    const actionButton = (action: (typeof row.actions)[number]) => (
      <button
        key={action.name}
        type="button"
        disabled={!action.enabled || loading || props.disabled}
        className="text-primary underline-offset-4 hover:underline disabled:opacity-50"
        onClick={async () => {
          await runAction(action, { ids: [row.key], record: row.cells })
          emit('action', { action: action.name, id: row.key })
        }}
      >
        {action.label}
      </button>
    )
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {ungrouped.map(actionButton)}
        {[...groups].map(([name, actions]) => (
          <details className="relative" key={name}>
            <summary className="cursor-pointer list-none rounded border px-2 py-1">{name}</summary>
            <div className="absolute right-0 z-20 mt-1 flex min-w-max flex-col gap-1 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
              {actions.map(actionButton)}
            </div>
          </details>
        ))}
      </div>
    )
  }
  function renderFilter(filter: TableDescriptor['filters'][number]) {
    const current = tableState.query[`filters[${filter.name}]`] ?? ''
    if (filter.type === 'custom' && filter.form?.spec)
      return (
        <CustomFilter
          filter={filter}
          setFilter={tableState.setFilter}
          query={tableState.query}
          key={`${filter.name}:${typeof window === 'undefined' ? '' : window.location.search}`}
        />
      )
    if (filter.type === 'select')
      return (
        <label className="flex min-w-36 flex-col gap-1 text-sm" key={filter.name}>
          <span>{filter.label}</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2"
            value={String(current)}
            onChange={(event) => tableState.setFilter(filter.name, event.currentTarget.value)}
          >
            <option value="">All</option>
            {(filter.options ?? []).map((option) => (
              <option key={String(option.value)} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )
    if (filter.type === 'ternary')
      return (
        <label className="flex min-w-36 flex-col gap-1 text-sm" key={filter.name}>
          <span>{filter.label}</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2"
            value={String(current)}
            onChange={(event) => tableState.setFilter(filter.name, event.currentTarget.value)}
          >
            <option value="">Any</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
      )
    if (filter.type === 'dateRange')
      return (
        <div className="flex flex-wrap items-end gap-2" key={filter.name}>
          <span className="w-full text-sm">{filter.label}</span>
          <input
            aria-label={`${filter.label} from`}
            type="date"
            className="h-9 rounded-md border border-input bg-background px-2"
            value={String(tableState.query[`filters[${filter.name}][from]`] ?? '')}
            onChange={(event) =>
              tableState.setQuery({
                [`filters[${filter.name}][from]`]: event.currentTarget.value,
                page: 1,
              })
            }
          />
          <input
            aria-label={`${filter.label} to`}
            type="date"
            className="h-9 rounded-md border border-input bg-background px-2"
            value={String(tableState.query[`filters[${filter.name}][to]`] ?? '')}
            onChange={(event) =>
              tableState.setQuery({
                [`filters[${filter.name}][to]`]: event.currentTarget.value,
                page: 1,
              })
            }
          />
        </div>
      )
    return (
      <label className="flex min-w-36 flex-col gap-1 text-sm" key={filter.name}>
        <span>{filter.label}</span>
        <input
          className="h-9 rounded-md border border-input bg-background px-2"
          value={String(current)}
          onChange={(event) => tableState.setFilter(filter.name, event.currentTarget.value)}
        />
      </label>
    )
  }

  return (
    <section className="space-y-3" aria-busy={loading || tableState.isLoading}>
      {props.label && <h2 className="text-base font-medium">{props.label}</h2>}
      {descriptor.tabs && descriptor.tabs.length > 0 && (
        <nav className="flex gap-1 border-b" aria-label="Table tabs">
          {descriptor.tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={String(tableState.query.tab ?? '') === tab.key ? 'page' : undefined}
              className={`border-b-2 px-3 py-2 text-sm ${String(tableState.query.tab ?? '') === tab.key ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
              onClick={() => tableState.setQuery({ tab: tab.key, page: 1 })}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      )}
      {descriptor.groups && descriptor.groups.length > 0 && (
        <label className="flex max-w-xs flex-col gap-1 text-sm">
          <span>Group</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2"
            value={String(tableState.query.group ?? '')}
            onChange={(event) => tableState.setQuery({ group: event.currentTarget.value, page: 1 })}
          >
            <option value="">All groups</option>
            {descriptor.groups.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-end gap-3">
        {descriptor.searchable && (
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
            <span>Search</span>
            <input
              className="h-9 rounded-md border border-input bg-background px-3"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') tableState.search(search)
              }}
            />
          </label>
        )}
        {descriptor.filters.length > 0 &&
          (descriptor.filtersLayout === 'above' ? (
            <div className="flex flex-wrap items-end gap-3">
              {descriptor.filters.map(renderFilter)}
              <button
                type="button"
                className="h-9 rounded-md border px-3 text-sm"
                onClick={() => tableState.resetFilters()}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <details className="relative">
              <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-md border px-3 text-sm">
                Filters
              </summary>
              <div
                className={`absolute left-0 z-20 mt-1 flex min-w-64 flex-col gap-3 rounded-md border bg-popover p-3 text-popover-foreground shadow-md ${descriptor.filtersLayout === 'slideover' ? 'fixed inset-y-0 right-0 left-auto z-50 mt-0 min-w-[min(22rem,90vw)] rounded-l-xl' : ''}`}
              >
                {descriptor.filters.map(renderFilter)}
                <button
                  type="button"
                  className="h-9 rounded-md border px-3 text-sm"
                  onClick={() => tableState.resetFilters()}
                >
                  Reset filters
                </button>
              </div>
            </details>
          ))}
        {columnsVisible && (
          <details className="relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-md border px-3 text-sm">
              Columns
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex min-w-max flex-col gap-2 rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <label key={column.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                    {descriptor.columns.find((item) => item.name === column.id)?.label ?? column.id}
                  </label>
                ))}
            </div>
          </details>
        )}
      </div>
      {selected.length > 0 && descriptor.bulkActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
          <span>{selected.length} selected</span>
          {descriptor.bulkActions
            .filter((action) => action.enabled)
            .map((action) => (
              <button
                key={action.name}
                type="button"
                disabled={loading || props.disabled}
                className="rounded-md border px-3 py-1 hover:bg-background disabled:opacity-50"
                onClick={async () => {
                  await runAction(action, { ids: selected })
                  emit('action', { action: action.name, ids: selected })
                }}
              >
                {action.label}
              </button>
            ))}
        </div>
      )}
      {tableData?.groups && tableData.groups.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {tableData.groups.map((group) => (
            <section key={group.key} className="rounded-md border bg-muted/20 p-3">
              <h3 className="text-sm font-medium">{group.label}</h3>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>{group.rows.length} rows</span>
                {group.summary &&
                  Object.entries(group.summary).flatMap(([column, summaries]) =>
                    Object.entries(summaries).map(([name, value]) => (
                      <span key={`${column}-${name}`}>
                        {descriptor.columns.find((item) => item.name === column)?.label ?? column}{' '}
                        {name}: <strong className="text-foreground">{value}</strong>
                      </span>
                    ))
                  )}
              </div>
            </section>
          ))}
        </div>
      )}
      {descriptor.layout === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {table.getRowModel().rows.map((row) => (
            <article
              key={row.id}
              className="space-y-3 rounded-md border p-4"
              draggable={Boolean(descriptor.reorderable)}
              onDragStart={() => setDraggedKey(row.original.key)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorderRow(row.original)}
            >
              <div className="flex items-center justify-between gap-3">
                {descriptor.selectable && (
                  <input
                    type="checkbox"
                    aria-label={`Select row ${row.original.key}`}
                    disabled={!row.original.selectable}
                    checked={selected.includes(row.original.key)}
                    onChange={(event) => selectRow(row.original.key, event.currentTarget.checked)}
                  />
                )}
                {row.original.url ? (
                  <a className="font-medium text-primary hover:underline" href={row.original.url}>
                    {displayValue(row.original.cells[descriptor.columns[0]?.name]) ||
                      String(row.original.key)}
                  </a>
                ) : (
                  <strong>
                    {displayValue(row.original.cells[descriptor.columns[0]?.name]) ||
                      String(row.original.key)}
                  </strong>
                )}
              </div>
              {row
                .getVisibleCells()
                .slice(1)
                .map((cell) => (
                  <div key={cell.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {descriptor.columns.find((column) => column.name === cell.column.id)?.label}
                    </span>
                    <span>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                  </div>
                ))}
              {renderActions(row.original)}
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/50">
              <tr>
                {descriptor.reorderable && <th className="w-8 px-2" aria-label="Reorder" />}
                {descriptor.selectable && (
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={allSelected}
                      onChange={(event) =>
                        tableState.setSelected(
                          event.currentTarget.checked ? selectableRows.map((row) => row.key) : []
                        )
                      }
                    />
                  </th>
                )}
                {table.getHeaderGroups()[0]?.headers.map((header) => {
                  const column = descriptor.columns.find((item) => item.name === header.column.id)
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 font-medium ${column?.alignment === 'end' ? 'text-right' : column?.alignment === 'center' ? 'text-center' : 'text-left'}`}
                      style={{ width: column?.width }}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => changeSort(header.column.id)}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {tableState.query.sort === header.column.id
                            ? ' ↑'
                            : tableState.query.sort === `-${header.column.id}`
                              ? ' ↓'
                              : ''}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const item = row.original
                return (
                  <tr
                    key={row.id}
                    className={`border-t ${descriptor.striped && row.index % 2 ? 'bg-muted/30' : ''}`}
                    draggable={Boolean(descriptor.reorderable)}
                    onDragStart={() => setDraggedKey(item.key)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => reorderRow(item)}
                  >
                    {descriptor.reorderable && (
                      <td
                        className="cursor-grab px-2 text-muted-foreground"
                        aria-label="Drag to reorder"
                      >
                        ⋮⋮
                      </td>
                    )}
                    {descriptor.selectable && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select row ${item.key}`}
                          disabled={!item.selectable}
                          checked={selected.includes(item.key)}
                          onChange={(event) => selectRow(item.key, event.currentTarget.checked)}
                        />
                      </td>
                    )}
                    {row.getVisibleCells().map((cell, index) => (
                      <td
                        key={cell.id}
                        className={`px-3 py-2 ${descriptor.columns.find((column) => column.name === cell.column.id)?.alignment === 'end' ? 'text-right' : descriptor.columns.find((column) => column.name === cell.column.id)?.alignment === 'center' ? 'text-center' : ''}`}
                        style={{
                          width: descriptor.columns.find((column) => column.name === cell.column.id)
                            ?.width,
                        }}
                      >
                        {index === 0 && item.url ? (
                          <a className="text-primary hover:underline" href={item.url}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </a>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2">{renderActions(item)}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-muted-foreground"
                    colSpan={
                      descriptor.columns.length +
                      (descriptor.selectable ? 1 : 0) +
                      (descriptor.reorderable ? 1 : 0) +
                      1
                    }
                  >
                    {descriptor.emptyState?.heading ?? 'No results.'}
                    {descriptor.emptyState?.description && (
                      <div className="mt-1">{descriptor.emptyState.description}</div>
                    )}
                    {descriptor.emptyState?.action && (
                      <div>
                        <button
                          type="button"
                          disabled={
                            !descriptor.emptyState.action.enabled || loading || props.disabled
                          }
                          className="mt-3 rounded-md border px-3 py-1 text-foreground hover:bg-background disabled:opacity-50"
                          onClick={async () => {
                            const action = descriptor.emptyState?.action
                            if (!action) return
                            await runAction(action)
                            emit('action', { action: action.name })
                          }}
                        >
                          {descriptor.emptyState.action.label}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tableData?.summary && (
        <div className="flex flex-wrap gap-4 rounded-md border bg-muted/20 p-3 text-sm">
          {Object.entries(tableData.summary).flatMap(([column, summaries]) =>
            Object.entries(summaries).map(([name, value]) => (
              <div key={`${column}-${name}`}>
                <span className="text-muted-foreground">
                  {descriptor.columns.find((item) => item.name === column)?.label ?? column} {name}
                  :{' '}
                </span>
                <strong>{value}</strong>
              </div>
            ))
          )}
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{meta ? `${meta.from}–${meta.to} of ${meta.total}` : `${rows.length} results`}</span>
        <div className="flex items-center gap-2">
          {descriptor.perPageOptions.length > 0 && (
            <select
              className="h-8 rounded-md border bg-background px-2"
              aria-label="Rows per page"
              value={String(
                tableState.query.perPage ?? meta?.perPage ?? descriptor.perPageOptions[0]
              )}
              onChange={(event) =>
                tableState.setPerPage(
                  event.currentTarget.value === 'all' ? 'all' : Number(event.currentTarget.value)
                )
              }
            >
              {descriptor.perPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option} per page
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="rounded-md border px-3 py-1 disabled:opacity-50"
            disabled={page <= 1 || loading || props.disabled}
            onClick={() => {
              tableState.setPage(page - 1)
              emit('reload', { page: page - 1 })
            }}
          >
            Previous
          </button>
          <span>
            {page} / {lastPage}
          </span>
          <button
            type="button"
            className="rounded-md border px-3 py-1 disabled:opacity-50"
            disabled={page >= lastPage || loading || props.disabled}
            onClick={() => {
              tableState.setPage(page + 1)
              emit('reload', { page: page + 1 })
            }}
          >
            Next
          </button>
        </div>
      </footer>
      {children}
    </section>
  )
}

export default DataTable
