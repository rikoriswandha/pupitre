import { DataTableViews } from './DataTableViews.js'
import {
  createElement,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { matchesKeyBinding } from '@rikology/pupitre-react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { Cell, ColumnDef, Row } from '@tanstack/react-table'
import type {
  ColumnDescriptor,
  JsonRenderSpec,
  TableData,
  TableDescriptor,
  TableRow,
} from '@rikology/pupitre/catalog'
import { getRouter, jsonFetch, t, useRunAction, useTable } from '@rikology/pupitre-react'
import { useTableRealtime } from '@rikology/pupitre-react'
import { useRuntime } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { NavLink } from '../primitives/nav_link.js'
import { SpecRenderer } from '@rikology/pupitre-react'
import { DataTableEditableCell } from './DataTableEditableCell.js'
import { DataTableGrid } from './DataTableGrid.js'
import { Popover } from '@base-ui/react/popover'
import { Dialog } from '@base-ui/react/dialog'
import {
  Badge,
  Button,
  CheckboxControl,
  EmptyState,
  Input,
  InputGroup,
  InputSlot,
  Panel,
  Skeleton,
  buttonClasses,
  cn,
  controlClasses,
  popupClasses,
  positionerClasses,
  SelectMenu,
  backdropClasses,
  sheetPopupClasses,
  segmentedListClasses,
  segmentedItemClasses,
  toTone,
} from '../primitives/index.js'
import { ActionList, ActionMenu } from './ActionList.js'
import { PanelNestingContext } from './Section.js'

import { DataTableGroups } from './DataTableGroups.js'
import { DataTableSummary } from './DataTableSummary.js'

const DataTableQueryBuilder = lazy(() =>
  import('./DataTableQueryBuilder.js').then((module) => ({ default: module.DataTableQueryBuilder }))
)
export type DataTableProps = {
  props: { descriptor: TableDescriptor; label?: string | null; disabled?: boolean }
  children?: ReactNode
  emit: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
  tableData?: TableData
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? t('Yes') : t('No')
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

function CustomColumnCell({
  column,
  value,
  row,
}: {
  column: ColumnDescriptor
  value: unknown
  row: TableRow
}) {
  const { registry } = useRuntime()
  const name = column.component!
  const Component = registry.registry[name]
  if (!Component)
    throw new Error(
      `Pupitre column component "${name}" is not registered. Add it to defineRegistry() with its catalog extension.`
    )
  return createElement(Component, {
    element: {
      type: name,
      props: { ...column.props, descriptor: column, value, row },
    },
    emit: () => {},
    on: () => ({ emit: () => {}, bound: false, shouldPreventDefault: false }),
  })
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
type CustomFilterDescriptor = {
  name: string
  label: string
  form?: { spec?: unknown }
}

function CustomFilterForm({
  filter,
  spec,
  setFilter,
  query,
}: {
  filter: CustomFilterDescriptor
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
        {t('Apply')}
      </button>
    </div>
  )
}

function CustomFilter(props: {
  filter: CustomFilterDescriptor
  setFilter: (name: string, value: unknown) => void
  query: Record<string, unknown>
}) {
  const spec = props.filter.form?.spec as JsonRenderSpec | undefined
  return spec ? <CustomFilterForm {...props} spec={spec} /> : null
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
  if (column.type === 'badge' || (column.type === 'text' && column.props.badge)) {
    // Semantic names (success, gray, …) select a theme tone; anything else is a raw CSS color.
    const color =
      (typeof cell?.color === 'string' ? cell.color : undefined) ??
      colors?.[text] ??
      (column.props.color as string | undefined)
    const tone = toTone(color, 'gray')
    const semantic =
      color === undefined || tone === color || color === 'destructive' || color === 'secondary'
    return (
      <Badge color={tone} style={semantic ? undefined : { backgroundColor: color }}>
        {text}
      </Badge>
    )
  }
  if (column.type === 'toggle')
    return (
      <span
        role="img"
        aria-label={raw ? t('Enabled') : t('Disabled')}
        className={raw ? 'text-primary' : 'text-muted-foreground'}
      >
        {raw ? t('On') : t('Off')}
      </span>
    )
  if (column.type === 'icon') {
    const icons =
      column.props.icons && typeof column.props.icons === 'object'
        ? (column.props.icons as Record<string, string>)
        : undefined
    return (
      <span role="img" aria-label={text} title={text}>
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
      <a
        className={`text-foreground hover:underline ${column.wrap ? 'whitespace-normal' : 'whitespace-nowrap'}`}
        href={url}
      >
        {truncated}
      </a>
    ) : (
      <span
        title={limit !== undefined && text.length > limit ? text : undefined}
        className={column.wrap ? 'whitespace-normal' : 'whitespace-nowrap'}
      >
        {truncated}
      </span>
    )
  if (column.type === 'custom' || column.type === 'fragment')
    return (
      <span data-custom-component={String(column.props.component ?? '')}>
        {text || t('Custom column content')}
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
          {t('Copy')}
        </button>
      )}
    </span>
  )
}

// A fresh `[]` per render makes TanStack recompute its row model and queue a
// page-index reset on every render, which loops forever once anything re-renders.
const NO_ROWS: TableRow[] = []

/** Bordered, shadowless table container for tables rendered inside another panel. */
function NestedTableSurface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-card', className)} {...props} />
}

export function DataTable({
  props,
  children,
  emit,
  loading = false,
  tableData: fallbackData,
}: DataTableProps) {
  const descriptor = props.descriptor as TableDescriptor & { striped?: boolean }
  const tableState = useTable(descriptor, fallbackData)
  // Inside another panel (tabs, sections, modals) the table drops its own panel chrome.
  const TableSurface = useContext(PanelNestingContext) ? NestedTableSurface : Panel
  const runAction = useRunAction()
  const realtime = useTableRealtime(descriptor)
  const tableData =
    tableState.data && typeof tableState.data === 'object' && 'rows' in tableState.data
      ? (tableState.data as TableData)
      : undefined
  const rows = tableData?.rows ?? NO_ROWS
  const activeGroup =
    descriptor.groups?.find((group) => group.key === tableData?.query.groupBy) ??
    descriptor.groups?.[0]
  const [search, setSearch] = useState(
    typeof tableState.query.q === 'string' ? tableState.query.q : ''
  )
  const [columnSearchDraft, setColumnSearchDraft] = useState<Record<string, string>>({})
  const [draggedKey, setDraggedKey] = useState<string | number | null>(null)
  const editing = useRef(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      descriptor.columns.map((column) => [column.name, !column.toggleable?.hiddenByDefault])
    )
  )
  const [visibilityLoaded, setVisibilityLoaded] = useState(false)
  const editVersion = useRef(0)
  const refreshSequence = useRef(0)
  const refreshRequests = useRef(new Map<string, number>())
  const [landedRefresh, setLandedRefresh] = useState<number | undefined>(undefined)
  useEffect(() => {
    const requests = refreshRequests.current
    const removeStart = getRouter().on('start', (event) => {
      const visit = event.detail.visit
      if (
        visit.method === 'get' &&
        (visit.only.length === 0 || visit.only.includes(descriptor.dataProp ?? 'data'))
      )
        requests.set(visit.id, ++refreshSequence.current)
    })
    // Same-URL reloads replace history and need not emit `navigate`.
    const removeSuccess = getRouter().on('success', (event) => {
      const id = event.detail.visitId
      if (id && requests.has(id)) {
        setLandedRefresh(requests.get(id))
        requests.delete(id)
      }
    })
    const removeFinish = getRouter().on('finish', (event) => {
      requests.delete(event.detail.visit.id)
    })
    return () => {
      removeStart()
      removeSuccess()
      removeFinish()
    }
  }, [descriptor.dataProp])
  const [optimisticCells, setOptimisticCells] = useState<
    Record<
      string,
      {
        value: unknown
        token: number
        pending: boolean
        settledSequence?: number
        previous?: { value: unknown; settledSequence?: number }
      }
    >
  >({})
  const [cellDataSource, setCellDataSource] = useState({ data: tableData, refresh: landedRefresh })
  if (cellDataSource.data !== tableData || cellDataSource.refresh !== landedRefresh) {
    setCellDataSource({ data: tableData, refresh: landedRefresh })
    // Props may render before success identifies the GET that produced them.
    // Keep settled edits until that event; prop-only hosts remain authoritative.
    const sequence =
      cellDataSource.refresh !== landedRefresh
        ? (landedRefresh ?? 0)
        : refreshRequests.current.size > 0
          ? 0
          : ++refreshSequence.current
    const incoming = new Map<string, unknown>()
    for (const row of rows) {
      for (const [name, cellValue] of Object.entries(row.cells)) {
        const data =
          cellValue && typeof cellValue === 'object' ? (cellValue as Record<string, unknown>) : {}
        incoming.set(`${row.key}:${name}`, data.value ?? cellValue)
      }
    }
    setOptimisticCells((current) =>
      Object.fromEntries(
        Object.entries(current)
          .filter(
            ([key, edit]) =>
              edit.pending ||
              (sequence <= (edit.settledSequence ?? 0) && !Object.is(incoming.get(key), edit.value))
          )
          .map(([key, edit]) => [
            key,
            {
              ...edit,
              previous:
                edit.previous &&
                sequence <= (edit.previous.settledSequence ?? 0) &&
                !Object.is(incoming.get(key), edit.previous.value)
                  ? edit.previous
                  : undefined,
            },
          ])
      )
    )
  }
  const [filterDraft, setFilterDraft] = useState<Record<string, unknown>>({})
  const [queryFilterValidity, setQueryFilterValidity] = useState<Record<string, boolean>>({})
  const queryFiltersValid = descriptor.filters.every(
    (filter) => filter.type !== 'queryBuilder' || queryFilterValidity[filter.name] === true
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(`pupitre:columns:${descriptor.id}`)
      if (saved)
        setVisibility((current) => ({
          ...current,
          ...(JSON.parse(saved) as Record<string, boolean>),
        }))
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    } finally {
      setVisibilityLoaded(true)
    }
  }, [descriptor.id])
  useEffect(() => {
    if (typeof window === 'undefined' || !visibilityLoaded) return
    try {
      window.localStorage.setItem(`pupitre:columns:${descriptor.id}`, JSON.stringify(visibility))
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }, [descriptor.id, visibility, visibilityLoaded])
  useEffect(() => {
    if (realtime || !descriptor.poll || descriptor.poll <= 0 || typeof window === 'undefined')
      return
    const timer = window.setInterval(() => {
      const modalOpen = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).some(
        (dialog) => {
          const style = window.getComputedStyle(dialog)
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            dialog.getClientRects().length > 0
          )
        }
      )
      if (document.visibilityState === 'hidden' || editing.current || modalOpen) return
      getRouter().reload({ only: [descriptor.dataProp ?? 'data'] })
    }, descriptor.poll)
    return () => window.clearInterval(timer)
  }, [descriptor.poll, descriptor.dataProp, realtime])

  const querySearch = tableState.query.q
  const searchTable = tableState.search
  const lastSubmittedSearch = useRef(String(querySearch ?? ''))
  const searchTimer = useRef<number | undefined>(undefined)
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
    searchTimer.current = window.setTimeout(
      () => {
        searchTimer.current = undefined
        lastSubmittedSearch.current = search
        searchTable(search)
      },
      Math.max(0, descriptor.searchDebounce)
    )
    return () => {
      if (searchTimer.current !== undefined) window.clearTimeout(searchTimer.current)
    }
  }, [descriptor.searchable, descriptor.searchDebounce, search, querySearch, searchTable])

  const columnDescriptors = useMemo(
    () => new Map(descriptor.columns.map((column) => [column.name, column])),
    [descriptor.columns]
  )
  const columns = useMemo<ColumnDef<TableRow>[]>(
    () =>
      descriptor.columns.map((column) => ({
        id: column.name,
        accessorFn: (row) => row.cells[column.name],
        header: column.label,
        enableSorting: column.sortable,
        enableHiding: Boolean(column.toggleable),
      })),
    [descriptor.columns]
  )
  /** `wrap` forces text wrapping where there is no horizontal scroll, e.g. grid cards. */
  function renderCell(cell: Cell<TableRow, unknown>, wrap = false) {
    const base = columnDescriptors.get(cell.column.id)!
    const column = wrap && !base.wrap ? { ...base, wrap: true } : base
    const value = cell.getValue()
    if (column.type === 'custom' && column.component)
      return <CustomColumnCell column={column} value={value} row={cell.row.original} />
    if (!column.editable) return <DataTableCell value={value} column={column} />
    const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
    const key = `${cell.row.original.key}:${column.name}`
    return (
      <DataTableEditableCell
        column={column}
        rowKey={cell.row.original.key}
        value={key in optimisticCells ? optimisticCells[key].value : (data.value ?? value)}
        serverValue={data.value ?? value}
        display={
          key in optimisticCells
            ? undefined
            : typeof data.display === 'string'
              ? data.display
              : undefined
        }
        disabled={data.disabled === true}
        onChange={(next) => {
          const token = ++editVersion.current
          setOptimisticCells((current) => ({
            ...current,
            [key]: { value: next, token, pending: true, previous: current[key] },
          }))
          return token
        }}
        onSettled={(token, success) => {
          setOptimisticCells((current) => {
            if (current[key]?.token !== token) return current
            const next = { ...current }
            if (success)
              next[key] = {
                ...current[key],
                pending: false,
                settledSequence: refreshSequence.current,
                previous: undefined,
              }
            else if (current[key].previous)
              next[key] = { ...current[key].previous, token, pending: false }
            else delete next[key]
            return next
          })
        }}
        onEditingChange={(active) => {
          editing.current = active
        }}
      />
    )
  }
  // TanStack returns a mutable table instance; this render path uses its documented APIs directly.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table exposes a mutable instance for its documented rendering APIs.
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => String(row.key),
    getCoreRowModel: getCoreRowModel(),
    // Paging, sorting and filtering are server-side (URL state); never auto-reset locally.
    manualPagination: true,
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: (updater) =>
      setVisibility((current) => (typeof updater === 'function' ? updater(current) : updater)),
  })
  const tableRowsByKey = new Map(
    table.getRowModel().rows.map((row) => [row.original.key, row] as const)
  )
  const meta = tableData?.meta
  const selected = tableState.selected
  const bulkActions = descriptor.bulkActions.filter((action) => action.enabled)
  useEffect(() => {
    if (bulkActions.length === 0 || selected.length === 0) return
    const handler = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLInputElement && !['checkbox', 'radio'].includes(target.type)))
      )
        return
      const action = bulkActions.find((item) =>
        (item.keyBindings ?? []).some((binding) => matchesKeyBinding(event, binding))
      )
      if (!action) return
      event.preventDefault()
      void runAction(action, { ids: selected })
      emit('action', { action: action.name, ids: selected })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [bulkActions, selected, runAction, emit])
  const selectableRows = rows.filter((row) => row.selectable)
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selected.includes(row.key))
  const page = meta?.currentPage ?? 1
  const lastPage = meta?.lastPage ?? 1
  const pageSize =
    tableState.query.perPage === 'all'
      ? rows.length
      : Number(tableState.query.perPage ?? meta?.perPage ?? rows.length)
  const reorderableWindow =
    !descriptor.groups?.length &&
    !Object.keys(tableState.query).some(
      (key) => !['page', 'perPage'].includes(key) && tableState.query[key] !== ''
    )
  const columnsVisible = descriptor.columns.some((column) => column.toggleable)

  function selectRow(key: string | number, checked: boolean) {
    tableState.setSelected(
      checked ? [...new Set([...selected, key])] : selected.filter((existing) => existing !== key)
    )
  }
  function changeSort(column: string, additive = false) {
    if (reorderMode) return
    tableState.sort(column, additive)
    emit('column', { column })
  }
  async function reorderRow(target: TableRow) {
    if (!descriptor.reorderable || draggedKey === null || draggedKey === target.key) return
    const order = rows.map((row) => row.key)
    const from = order.indexOf(draggedKey)
    const to = order.indexOf(target.key)
    if (from < 0 || to < 0) return
    order.splice(from, 1)
    order.splice(to, 0, draggedKey)
    try {
      const response = await jsonFetch(descriptor.reorderable.url, {
        method: 'POST',
        body: JSON.stringify({ ids: order, offset: (page - 1) * pageSize }),
      })
      if (!response.ok) throw new Error(t('Unable to reorder records'))
      getRouter().reload({ only: [descriptor.dataProp ?? 'data'] })
      emit('reorder', { ids: order, url: descriptor.reorderable.url })
    } finally {
      setDraggedKey(null)
    }
  }
  async function moveRow(key: string | number, direction: -1 | 1) {
    const index = rows.findIndex((row) => row.key === key)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) return
    const order = rows.map((row) => row.key)
    ;[order[index], order[targetIndex]] = [order[targetIndex], order[index]]
    const response = await jsonFetch(descriptor.reorderable!.url, {
      method: 'POST',
      body: JSON.stringify({ ids: order, offset: (page - 1) * pageSize }),
    })
    if (response.ok) getRouter().reload({ only: [descriptor.dataProp ?? 'data'] })
  }
  function renderActions(row: TableRow) {
    return (
      <ActionList
        actions={row.actions.filter((action) => action.enabled)}
        appearance="links"
        max={2}
        align="end"
        ids={[row.key]}
        record={row.cells}
        disabled={loading || props.disabled}
        onRun={(action) => emit('action', { action: action.name, id: row.key })}
      />
    )
  }
  function renderGridCard(row: Row<TableRow>) {
    const firstCell = row.getVisibleCells()[0]
    const firstColumn = firstCell ? columnDescriptors.get(firstCell.column.id) : undefined
    return (
      <article
        key={row.original.key}
        className={`space-y-3 rounded-lg border border-border p-4 text-sm transition-colors hover:bg-muted/40 ${selected.includes(row.original.key) ? 'bg-primary-soft/60' : ''} ${row.original.className ?? ''}`}
        draggable={reorderMode}
        onDragOver={(event) => {
          if (reorderMode) event.preventDefault()
        }}
        onDrop={() => {
          if (reorderMode) void reorderRow(row.original)
        }}
      >
        {reorderMode && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="xs"
              square
              draggable
              aria-label={t('Drag {key}', { key: row.original.key })}
              onDragStart={() => setDraggedKey(row.original.key)}
            >
              <Icon name="grip-vertical" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              square
              aria-label={t('Move {key} up', { key: row.original.key })}
              onClick={() => void moveRow(row.original.key, -1)}
            >
              <Icon name="chevron-up" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              square
              aria-label={t('Move {key} down', { key: row.original.key })}
              onClick={() => void moveRow(row.original.key, 1)}
            >
              <Icon name="chevron-down" />
            </Button>
          </div>
        )}
        <div className="flex items-start gap-3">
          {descriptor.selectable && (
            <CheckboxControl
              className="size-6"
              aria-label={t('Select row {key}', { key: row.original.key })}
              disabled={!row.original.selectable}
              checked={selected.includes(row.original.key)}
              onCheckedChange={(checked) => selectRow(row.original.key, checked)}
            />
          )}
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {firstColumn?.component && firstColumn.type === 'custom' && firstCell ? (
              row.original.url && !firstColumn.editable ? (
                <NavLink className="text-foreground hover:underline" href={row.original.url}>
                  {renderCell(firstCell)}
                </NavLink>
              ) : (
                renderCell(firstCell)
              )
            ) : (
              <>
                {firstColumn?.editable && firstCell ? (
                  renderCell(firstCell)
                ) : row.original.url ? (
                  <NavLink
                    className="font-medium text-foreground hover:underline"
                    href={row.original.url}
                  >
                    {displayValue(row.original.cells[firstColumn?.name ?? '']) ||
                      String(row.original.key)}
                  </NavLink>
                ) : (
                  <strong>
                    {displayValue(row.original.cells[firstColumn?.name ?? '']) ||
                      String(row.original.key)}
                  </strong>
                )}
              </>
            )}
          </div>
        </div>
        {row
          .getVisibleCells()
          .slice(1)
          .map((cell) => (
            <div key={cell.id} className="flex justify-between gap-3 text-sm">
              <span className="shrink-0 text-muted-foreground">
                {columnDescriptors.get(cell.column.id)?.label}
              </span>
              <span className="min-w-0 text-right [overflow-wrap:anywhere]">
                {renderCell(cell, true)}
              </span>
            </div>
          ))}
        {renderActions(row.original)}
      </article>
    )
  }
  function renderTableRow(row: Row<TableRow>) {
    const item = row.original
    return (
      <tr
        key={row.original.key}
        className={`border-t border-border transition-colors hover:bg-muted/40 ${selected.includes(item.key) ? 'bg-primary-soft/60' : ''} ${item.className ?? ''} ${descriptor.striped && row.index % 2 ? 'bg-muted/30' : ''}`}
        draggable={reorderMode}
        onDragOver={(event) => {
          if (reorderMode) event.preventDefault()
        }}
        onDrop={() => {
          if (reorderMode) void reorderRow(item)
        }}
      >
        {descriptor.reorderable && (
          <td className="px-2 text-muted-foreground">
            {reorderMode && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  square
                  draggable
                  aria-label={t('Drag {key}', { key: item.key })}
                  onDragStart={() => setDraggedKey(item.key)}
                >
                  <Icon name="grip-vertical" />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  square
                  aria-label={t('Move {key} up', { key: item.key })}
                  onClick={() => void moveRow(item.key, -1)}
                >
                  <Icon name="chevron-up" />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  square
                  aria-label={t('Move {key} down', { key: item.key })}
                  onClick={() => void moveRow(item.key, 1)}
                >
                  <Icon name="chevron-down" />
                </Button>
              </div>
            )}
          </td>
        )}
        {descriptor.selectable && (
          <td className="px-4 py-(--row-py)">
            <CheckboxControl
              className="size-6 -my-1 align-middle"
              aria-label={t('Select row {key}', { key: item.key })}
              disabled={!item.selectable}
              checked={selected.includes(item.key)}
              onCheckedChange={(checked) => selectRow(item.key, checked)}
            />
          </td>
        )}
        {row.getVisibleCells().map((cell, index) => {
          const column = columnDescriptors.get(cell.column.id)
          return (
            <td
              key={cell.id}
              className={`px-4 py-(--row-py) tabular-nums ${index === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'} ${
                column?.alignment === 'end'
                  ? 'text-right'
                  : column?.alignment === 'center'
                    ? 'text-center'
                    : ''
              }`}
              style={{ width: column?.width }}
            >
              {index === 0 && item.url && !column?.editable ? (
                <NavLink className="text-foreground hover:underline" href={item.url}>
                  {renderCell(cell)}
                </NavLink>
              ) : (
                renderCell(cell)
              )}
            </td>
          )
        })}
        <td className="px-4 py-(--row-py)">{renderActions(item)}</td>
      </tr>
    )
  }
  function setFilterValue(name: string, value: unknown) {
    if (descriptor.deferFilters) setFilterDraft((current) => ({ ...current, [name]: value }))
    else tableState.setFilter(name, value)
  }
  function resetFilterDraft() {
    setFilterDraft(
      Object.fromEntries(
        descriptor.filters.map((filter) => [
          filter.name,
          filter.type === 'dateRange' ? { from: '', to: '' } : '',
        ])
      )
    )
  }
  function applyFilterDraft() {
    if (!queryFiltersValid) return
    const patch: Record<string, unknown> = { page: 1 }
    for (const name of Object.keys(filterDraft)) {
      const prefix = `filters[${name}]`
      for (const key of Object.keys(tableState.query))
        if (key === prefix || key.startsWith(`${prefix}[`)) patch[key] = ''
      const value = filterDraft[name]
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, field] of Object.entries(value)) patch[`${prefix}[${key}]`] = field
      } else patch[prefix] = value
    }
    tableState.setQuery(patch)
  }
  function renderFilter(filter: TableDescriptor['filters'][number]) {
    if (reorderMode) return null
    const current = filterDraft[filter.name] ?? tableState.query[`filters[${filter.name}]`] ?? ''
    if (filter.type === 'queryBuilder')
      return (
        <Suspense
          key={filter.name}
          fallback={
            <div className="min-h-32 space-y-3" aria-busy="true" aria-label={filter.label}>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-48" />
            </div>
          }
        >
          <DataTableQueryBuilder
            filter={filter}
            value={String(current)}
            queryPrefix={descriptor.queryPrefix}
            deferred={descriptor.deferFilters}
            onApply={(value) => setFilterValue(filter.name, value)}
            onValidityChange={(valid) =>
              setQueryFilterValidity((previous) =>
                previous[filter.name] === valid ? previous : { ...previous, [filter.name]: valid }
              )
            }
          />
        </Suspense>
      )
    if (filter.type === 'custom') {
      const spec = filter.form?.spec
      return spec ? (
        <CustomFilter
          filter={filter}
          setFilter={setFilterValue}
          query={tableState.query}
          key={`${filter.name}:${typeof window === 'undefined' ? '' : window.location.search}`}
        />
      ) : null
    }
    if (filter.type === 'select')
      return (
        <div className="flex min-w-36 flex-col gap-1 text-sm" key={filter.name}>
          <span>{filter.label}</span>
          <SelectMenu
            aria-label={t('Filter {label}', { label: filter.label })}
            value={String(current)}
            onValueChange={(next) => setFilterValue(filter.name, next)}
            options={[
              { value: '', label: t('All') },
              ...(filter.options ?? []).map((option) => ({
                value: String(option.value),
                label: option.label,
              })),
            ]}
          />
        </div>
      )
    if (filter.type === 'ternary')
      return (
        <div className="flex min-w-36 flex-col gap-1 text-sm" key={filter.name}>
          <span>{filter.label}</span>
          <SelectMenu
            aria-label={t('Filter {label}', { label: filter.label })}
            value={String(current)}
            onValueChange={(next) => setFilterValue(filter.name, next)}
            options={[
              { value: '', label: t('Any') },
              { value: '1', label: t('Yes') },
              { value: '0', label: t('No') },
            ]}
          />
        </div>
      )
    if (filter.type === 'dateRange') {
      const range =
        current && typeof current === 'object' && !Array.isArray(current)
          ? (current as Record<string, unknown>)
          : {}
      return (
        <div className="flex min-w-36 flex-col gap-1 text-sm" key={filter.name}>
          <span>{filter.label}</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              aria-label={t('{label} from', { label: filter.label })}
              type="date"
              className={cn(controlClasses, 'h-9 px-3 tabular-nums')}
              value={String(range.from ?? tableState.query[`filters[${filter.name}][from]`] ?? '')}
              onChange={(event) =>
                descriptor.deferFilters
                  ? setFilterValue(filter.name, { ...range, from: event.currentTarget.value })
                  : tableState.setQuery({
                      [`filters[${filter.name}][from]`]: event.currentTarget.value,
                      page: 1,
                    })
              }
            />
            <input
              aria-label={t('{label} to', { label: filter.label })}
              type="date"
              className={cn(controlClasses, 'h-9 px-3 tabular-nums')}
              value={String(range.to ?? tableState.query[`filters[${filter.name}][to]`] ?? '')}
              onChange={(event) =>
                descriptor.deferFilters
                  ? setFilterValue(filter.name, { ...range, to: event.currentTarget.value })
                  : tableState.setQuery({
                      [`filters[${filter.name}][to]`]: event.currentTarget.value,
                      page: 1,
                    })
              }
            />
          </div>
        </div>
      )
    }
    if (filter.type === 'trashed')
      return (
        <div className="flex min-w-36 flex-col gap-1 text-sm" key={filter.name}>
          <span>{filter.label}</span>
          <SelectMenu
            aria-label={t('Filter {label}', { label: filter.label })}
            value={String(current || 'without')}
            onValueChange={(next) => setFilterValue(filter.name, next)}
            options={[
              { value: 'without', label: t('Without trashed') },
              { value: 'with', label: t('With trashed') },
              { value: 'only', label: t('Only trashed') },
            ]}
          />
        </div>
      )
    return null
  }

  const activeFilterCount = descriptor.filters.filter((filter) =>
    Object.entries(tableState.query).some(
      ([key, value]) =>
        (key === `filters[${filter.name}]` || key.startsWith(`filters[${filter.name}][`)) &&
        value !== '' &&
        value !== null &&
        value !== undefined &&
        value !== 'without'
    )
  ).length
  const filterForm = (
    <div className="grid gap-4">
      {descriptor.filters.map(renderFilter)}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (descriptor.deferFilters ? resetFilterDraft() : tableState.resetFilters())}
        >
          {t('Reset filters')}
        </Button>
        {descriptor.deferFilters && (
          <Button
            color="primary"
            size="sm"
            disabled={!queryFiltersValid}
            onClick={applyFilterDraft}
          >
            {t('Apply')}
          </Button>
        )}
      </div>
    </div>
  )
  const filterIcon = (
    <>
      <Icon name="list-filter" className="size-4" />
      {activeFilterCount > 0 && (
        <Badge size="sm" color="primary" className="absolute -right-1 -top-1">
          {activeFilterCount}
        </Badge>
      )}
    </>
  )
  const emptyContent =
    loading || tableState.isLoading || (descriptor.deferLoading && !tableData) ? (
      <div aria-label={t('Loading records')} className="grid gap-4 p-6">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
    ) : (
      <EmptyState
        icon={descriptor.emptyState?.icon ?? 'inbox'}
        heading={descriptor.emptyState?.heading ?? t('No records found')}
        description={
          descriptor.emptyState?.description ??
          (search || activeFilterCount
            ? t('Try clearing your search or filters to find records.')
            : t('Records will appear here once they are created.'))
        }
        actions={
          descriptor.emptyState?.action && (
            <ActionList
              actions={[descriptor.emptyState.action]}
              disabled={loading || props.disabled}
              onRun={(action) => emit('action', { action: action.name })}
            />
          )
        }
      />
    )
  return (
    <section className="space-y-3" aria-busy={loading || tableState.isLoading}>
      {props.label && <h2 className="text-base font-medium">{props.label}</h2>}
      {!reorderMode && descriptor.tabs && descriptor.tabs.length > 0 && (
        <nav className={segmentedListClasses} aria-label={t('Table tabs')}>
          {descriptor.tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={String(tableState.query.tab ?? '') === tab.key ? 'page' : undefined}
              className={segmentedItemClasses}
              onClick={() => tableState.setQuery({ tab: tab.key, page: 1 })}
            >
              {tab.label}
              {tab.badge !== undefined && <Badge size="sm">{tab.badge}</Badge>}
            </button>
          ))}
        </nav>
      )}
      <TableSurface className="overflow-hidden">
        {(Boolean(descriptor.groups?.length) ||
          Boolean(descriptor.views) ||
          selected.length > 0 ||
          Boolean(descriptor.reorderable) ||
          descriptor.searchable ||
          (Boolean(descriptor.multiSort) && tableState.sorts.length > 0) ||
          (descriptor.filters.length > 0 && descriptor.filtersLayout !== 'above') ||
          columnsVisible) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-3">
              {descriptor.views && (
                <DataTableViews
                  descriptor={descriptor}
                  query={Object.fromEntries(
                    Object.entries(tableData?.query ?? {}).filter(([key]) => key !== 'page')
                  )}
                  columns={visibility}
                  onColumns={setVisibility}
                />
              )}
              {!reorderMode && descriptor.groups && descriptor.groups.length > 0 && (
                <SelectMenu
                  aria-label={t('Group')}
                  className="w-auto max-w-48"
                  value={String(tableState.query.groupBy ?? '')}
                  onValueChange={(next) => tableState.setQuery({ groupBy: next, page: 1 })}
                  options={[
                    { value: '', label: t('All groups') },
                    ...descriptor.groups.map((group) => ({ value: group.key, label: group.label })),
                  ]}
                />
              )}
              {selected.length > 0 && (
                <div className="flex items-center gap-3 transition-opacity duration-150 ease-ui starting:opacity-0">
                  <span className="text-sm font-medium tabular-nums">
                    {t('{count} selected', { count: selected.length })}
                  </span>
                  {bulkActions.length > 0 && (
                    <ActionMenu
                      label={t('Bulk actions')}
                      actions={bulkActions}
                      ids={selected}
                      size="sm"
                      disabled={loading || props.disabled}
                      onRun={(action) => emit('action', { action: action.name, ids: selected })}
                    />
                  )}
                  <Button variant="ghost" size="sm" onClick={() => tableState.setSelected([])}>
                    {t('Deselect all')}
                  </Button>
                </div>
              )}
              {descriptor.reorderable && (
                <Button
                  variant="ghost"
                  square
                  aria-label={reorderMode ? t('Done reordering') : t('Reorder')}
                  aria-pressed={reorderMode}
                  disabled={!reorderMode && !reorderableWindow}
                  title={
                    !reorderMode && !reorderableWindow
                      ? t('Clear filters and sorting before reordering')
                      : undefined
                  }
                  onClick={() => setReorderMode((current) => !current)}
                >
                  <Icon name={reorderMode ? 'check' : 'grip-vertical'} className="size-4" />
                </Button>
              )}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {descriptor.searchable && (
                <InputGroup className="max-w-full" style={{ width: '16rem' }}>
                  <InputSlot className="pl-3 text-muted-foreground">
                    <Icon name="search" className="size-4" />
                  </InputSlot>
                  <Input
                    bare
                    type="search"
                    aria-label={t('Search')}
                    placeholder={t('Search')}
                    value={search}
                    disabled={reorderMode}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        if (searchTimer.current !== undefined)
                          window.clearTimeout(searchTimer.current)
                        searchTimer.current = undefined
                        lastSubmittedSearch.current = search
                        tableState.search(search)
                      }
                    }}
                  />
                </InputGroup>
              )}
              {!reorderMode && descriptor.multiSort && tableState.sorts.length > 0 && (
                <Button size="sm" variant="ghost" onClick={tableState.clearSort}>
                  {t('Clear sorting')}
                </Button>
              )}
              {!reorderMode &&
                descriptor.filters.length > 0 &&
                descriptor.filtersLayout !== 'above' &&
                (descriptor.filtersLayout === 'slideover' ? (
                  <Dialog.Root>
                    <Dialog.Trigger
                      aria-label={t('Filters')}
                      className={buttonClasses({ variant: 'ghost', square: true })}
                    >
                      {filterIcon}
                    </Dialog.Trigger>
                    <Dialog.Portal>
                      <Dialog.Backdrop className={backdropClasses} />
                      <Dialog.Popup data-pupitre-popup="" className={sheetPopupClasses('md')}>
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                          <Dialog.Title className="text-[0.9375rem] font-semibold">
                            {t('Filters')}
                          </Dialog.Title>
                          <Dialog.Close
                            aria-label={t('Close filters')}
                            className={buttonClasses({
                              variant: 'ghost',
                              square: true,
                              size: 'sm',
                            })}
                          >
                            <Icon name="x" />
                          </Dialog.Close>
                        </div>
                        <div className="overflow-y-auto p-5">{filterForm}</div>
                      </Dialog.Popup>
                    </Dialog.Portal>
                  </Dialog.Root>
                ) : (
                  <Popover.Root>
                    <Popover.Trigger
                      aria-label={t('Filters')}
                      className={buttonClasses({ variant: 'ghost', square: true })}
                    >
                      {filterIcon}
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Positioner align="end" sideOffset={8} className={positionerClasses}>
                        <Popover.Popup
                          data-pupitre-popup=""
                          className={cn(
                            popupClasses,
                            'w-80 max-h-[80vh] max-w-[calc(100vw-2rem)] overflow-y-auto p-4'
                          )}
                        >
                          <Popover.Title className="mb-4 text-sm font-semibold">
                            {t('Filters')}
                          </Popover.Title>
                          {filterForm}
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                ))}
              {columnsVisible && (
                <Popover.Root>
                  <Popover.Trigger
                    aria-label={t('Columns')}
                    className={buttonClasses({ variant: 'ghost', square: true })}
                  >
                    <Icon name="columns-3" className="size-4" />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner align="end" sideOffset={8} className={positionerClasses}>
                      <Popover.Popup
                        data-pupitre-popup=""
                        className={cn(popupClasses, 'min-w-52 p-3')}
                      >
                        <Popover.Title className="mb-3 text-sm font-semibold">
                          {t('Columns')}
                        </Popover.Title>
                        <div className="grid gap-3">
                          {table
                            .getAllLeafColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => (
                              <label key={column.id} className="flex items-center gap-2 text-sm">
                                <CheckboxControl
                                  checked={column.getIsVisible()}
                                  onCheckedChange={(checked) => column.toggleVisibility(checked)}
                                />
                                {columnDescriptors.get(column.id)?.label ?? column.id}
                              </label>
                            ))}
                        </div>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              )}
            </div>
          </div>
        )}
        {!reorderMode && descriptor.filters.length > 0 && descriptor.filtersLayout === 'above' && (
          <div className="border-b border-border bg-muted/40 px-5 py-4">{filterForm}</div>
        )}
        {descriptor.layout === 'grid' ? (
          rows.length === 0 ? (
            emptyContent
          ) : tableData?.groups ? (
            <DataTableGroups
              groups={tableData.groups}
              columns={descriptor.columns}
              definition={activeGroup}
              layout="grid"
              colSpan={descriptor.columns.length + (descriptor.selectable ? 1 : 0) + 1}
              renderRows={(groupRows) => (
                <DataTableGrid columns={descriptor.gridColumns}>
                  {groupRows.map((groupRow) => {
                    const row = tableRowsByKey.get(groupRow.key)
                    return row ? renderGridCard(row) : null
                  })}
                </DataTableGrid>
              )}
            />
          ) : (
            <DataTableGrid columns={descriptor.gridColumns}>
              {table.getRowModel().rows.map(renderGridCard)}
            </DataTableGrid>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  {descriptor.reorderable && <th className="w-8 px-2" aria-label={t('Reorder')} />}
                  {descriptor.selectable && (
                    <th className="w-10 px-3 py-2">
                      <CheckboxControl
                        className="size-6 -my-1 align-middle"
                        aria-label={t('Select all rows')}
                        checked={allSelected}
                        indeterminate={selected.length > 0 && !allSelected}
                        onCheckedChange={(checked) =>
                          tableState.setSelected(
                            checked ? selectableRows.map((row) => row.key) : []
                          )
                        }
                      />
                    </th>
                  )}
                  {table.getHeaderGroups()[0]?.headers.map((header) => {
                    const column = columnDescriptors.get(header.column.id)
                    const sortIndex = tableState.sorts.findIndex(
                      (item) => item.replace(/^-/, '') === header.column.id
                    )
                    const descending = tableState.sorts[sortIndex]?.startsWith('-')
                    return (
                      <th
                        key={header.id}
                        aria-sort={
                          sortIndex === 0
                            ? descending
                              ? 'descending'
                              : 'ascending'
                            : sortIndex < 0 && header.column.getCanSort()
                              ? 'none'
                              : undefined
                        }
                        className={`px-4 py-3 font-medium ${column?.alignment === 'end' ? 'text-right' : column?.alignment === 'center' ? 'text-center' : 'text-left'}`}
                        style={{ width: column?.width }}
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                              onClick={(event) => changeSort(header.column.id, event.shiftKey)}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <Icon
                                className="size-3.5 text-subtle-foreground"
                                name={
                                  sortIndex >= 0
                                    ? descending
                                      ? 'arrow-down'
                                      : 'arrow-up'
                                    : 'chevrons-up-down'
                                }
                              />
                              {descriptor.multiSort && sortIndex >= 0 && (
                                <span aria-hidden="true">{sortIndex + 1}</span>
                              )}
                            </button>
                            {descriptor.multiSort && sortIndex >= 0 && (
                              <span className="sr-only">
                                {t('Sort priority {number}, {direction}', {
                                  number: sortIndex + 1,
                                  direction: descending ? t('descending') : t('ascending'),
                                })}
                              </span>
                            )}
                            {descriptor.multiSort && (
                              <Button
                                size="xs"
                                variant="ghost"
                                square
                                aria-label={t('Add {column} to sort', {
                                  column: column?.label ?? header.column.id,
                                })}
                                title={t('Add {column} to sort', {
                                  column: column?.label ?? header.column.id,
                                })}
                                disabled={
                                  sortIndex < 0 && tableState.sorts.length >= descriptor.multiSort
                                }
                                onClick={() => changeSort(header.column.id, true)}
                              >
                                <Icon name="plus" className="size-3.5" />
                              </Button>
                            )}
                          </span>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    )
                  })}
                  <th className="px-3 py-2 text-right font-medium">{t('Actions')}</th>
                </tr>
                {!reorderMode &&
                  descriptor.columns.some((column) => column.individuallySearchable) && (
                    <tr>
                      {descriptor.reorderable && <th className="px-2" />}
                      {descriptor.selectable && <th className="px-3" />}
                      {table.getHeaderGroups()[0]?.headers.map((header) => {
                        const column = columnDescriptors.get(header.column.id)
                        if (!column?.individuallySearchable) return <th key={header.id} />
                        const queryKey = `columns[${column.name}][search]`
                        const searchValue =
                          columnSearchDraft[column.name] ?? tableState.query[queryKey] ?? ''
                        return (
                          <th key={header.id} className="px-3 pb-2">
                            <input
                              type="search"
                              aria-label={t('Search {label}', { label: column.label })}
                              className={`${controlClasses} h-8 px-2 font-normal`}
                              value={searchValue}
                              onChange={(event) =>
                                setColumnSearchDraft((current) => ({
                                  ...current,
                                  [column.name]: event.currentTarget.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return
                                tableState.setQuery({ [queryKey]: searchValue, page: 1 })
                              }}
                            />
                          </th>
                        )
                      })}
                      <th />
                    </tr>
                  )}
              </thead>
              <tbody
                aria-busy={loading || tableState.isLoading}
                className={loading || tableState.isLoading ? 'opacity-60' : undefined}
              >
                {tableData?.groups ? (
                  <DataTableGroups
                    groups={tableData.groups}
                    columns={descriptor.columns}
                    definition={activeGroup}
                    layout="table"
                    colSpan={
                      descriptor.columns.length +
                      (descriptor.selectable ? 1 : 0) +
                      (descriptor.reorderable ? 1 : 0) +
                      1
                    }
                    renderRows={(groupRows) =>
                      groupRows.map((groupRow) => {
                        const row = tableRowsByKey.get(groupRow.key)
                        return row ? renderTableRow(row) : null
                      })
                    }
                  />
                ) : (
                  table.getRowModel().rows.map(renderTableRow)
                )}
                {rows.length === 0 && (
                  <tr>
                    <td
                      className="text-center"
                      colSpan={
                        descriptor.columns.length +
                        (descriptor.selectable ? 1 : 0) +
                        (descriptor.reorderable ? 1 : 0) +
                        1
                      }
                    >
                      {emptyContent}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {tableData?.summary && (
          <DataTableSummary summary={tableData.summary} columns={descriptor.columns} />
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-[0.8125rem] text-muted-foreground sm:px-5">
          <span className="tabular-nums">
            {meta?.simple ? (
              t('{count} results', { count: rows.length })
            ) : (
              <>
                {meta
                  ? t('Showing {from} to {to} of {total} results', {
                      from: meta.from ?? 0,
                      to: meta.to ?? 0,
                      total: meta.total,
                    })
                  : t('{count} results', { count: rows.length })}
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            {descriptor.perPageOptions.length > 0 && (
              <SelectMenu
                size="sm"
                className="w-auto"
                aria-label={t('Rows per page')}
                value={String(
                  tableState.query.perPage ?? meta?.perPage ?? descriptor.perPageOptions[0]
                )}
                onValueChange={(next) =>
                  tableState.setPerPage(next === 'all' ? 'all' : Number(next))
                }
                options={descriptor.perPageOptions.map((option) => ({
                  value: String(option),
                  label: option === 'all' ? t('All') : t('{count} per page', { count: option }),
                }))}
              />
            )}
            <button
              type="button"
              aria-label={t('Previous')}
              className={buttonClasses({ variant: 'ghost', square: true, size: 'sm' })}
              disabled={page <= 1 || loading || props.disabled}
              onClick={() => {
                tableState.setPage(page - 1)
                emit('reload', { page: page - 1 })
              }}
            >
              <Icon name="chevron-left" />
            </button>
            <span className="whitespace-nowrap tabular-nums">
              {meta?.simple ? (
                page
              ) : (
                <>
                  {page} / {lastPage}
                </>
              )}
            </span>
            <button
              type="button"
              aria-label={t('Next')}
              className={buttonClasses({ variant: 'ghost', square: true, size: 'sm' })}
              disabled={page >= lastPage || loading || props.disabled}
              onClick={() => {
                tableState.setPage(page + 1)
                emit('reload', { page: page + 1 })
              }}
            >
              <Icon name="chevron-right" />
            </button>
          </div>
        </footer>
      </TableSurface>
      {children}
    </section>
  )
}

export default DataTable
