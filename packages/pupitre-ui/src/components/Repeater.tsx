import { Children, createContext, useId, type ReactNode } from 'react'
import { t, useSetState, useStateValue } from '@rikology/pupitre-react'
import { Button } from '../primitives/index.js'
import { Icon } from '../icons.js'
import { CollectionField } from './CollectionField.js'
import type { RepeaterDescriptor } from '@rikology/pupitre/catalog'

type RepeaterMetadata = {
  name: string
  minItems: number
  maxItems?: number
  addLabel?: string
  grid?: number | Record<string, number>
  reorderable: boolean
  cloneable: boolean
  collapsible: boolean
  table?: TableColumns
}
type TableColumns = NonNullable<RepeaterDescriptor['table']>
let cloneSequence = 0
type RepeaterContextValue = {
  minItems: number
  maxItems: number
  itemCount: number
  reorderable: boolean
  cloneable: boolean
  collapsible: boolean
  move: (index: number, direction: 'up' | 'down') => void
  moveTo: (index: number, target: number) => void
  disabled: boolean
  dragId: string
  table?: TableColumns
  grid?: number | Record<string, number>
  clone: (index: number) => void
  remove: (index: number) => void
}
type RuntimeProps = {
  props: Record<string, unknown>
  children?: ReactNode
  emit?: (event: string) => void
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

function readDescriptor(value: unknown): RepeaterMetadata | undefined {
  if (!value || typeof value !== 'object' || !('name' in value) || typeof value.name !== 'string')
    return undefined
  return {
    name: value.name,
    minItems: 'minItems' in value && typeof value.minItems === 'number' ? value.minItems : 0,
    maxItems:
      'maxItems' in value && typeof value.maxItems === 'number' ? value.maxItems : undefined,
    addLabel:
      'addLabel' in value && typeof value.addLabel === 'string' ? value.addLabel : undefined,
    grid:
      'grid' in value &&
      (typeof value.grid === 'number' ||
        (value.grid !== null && typeof value.grid === 'object' && !Array.isArray(value.grid)))
        ? (value.grid as RepeaterMetadata['grid'])
        : undefined,
    reorderable: 'reorderable' in value && value.reorderable === true,
    cloneable: 'cloneable' in value && value.cloneable === true,
    collapsible: 'collapsible' in value && value.collapsible === true,
    table:
      'table' in value && Array.isArray(value.table) ? (value.table as TableColumns) : undefined,
  }
}

export const RepeaterContext = createContext<RepeaterContextValue>({
  minItems: 0,
  maxItems: Number.POSITIVE_INFINITY,
  itemCount: 0,
  reorderable: false,
  cloneable: false,
  collapsible: false,
  move: () => {},
  moveTo: () => {},
  disabled: false,
  dragId: '',
  clone: () => {},
  remove: () => {},
})

export function Repeater({ props, children, emit, bindings, loading = false }: RuntimeProps) {
  const descriptor = readDescriptor(props.descriptor)
  const tableId = useId()
  const disabled = loading || props.disabled === true || props.readOnly === true
  const statePath = bindings?.value?.startsWith('/data/')
    ? bindings.value
    : descriptor
      ? `/data/${descriptor.name}`
      : undefined
  const stateItems = useStateValue(statePath ?? '/data')
  const errorPath = statePath?.replace(/^\/data\//, '/errors/')
  const errors = useStateValue(errorPath ?? '/errors')
  const items = Array.isArray(stateItems) ? stateItems : []
  const itemCount = Array.isArray(stateItems) ? items.length : Children.count(children)
  const min = descriptor?.minItems ?? 0
  const max = descriptor?.maxItems ?? Number.POSITIVE_INFINITY
  const setState = useSetState()
  const commitRows = (nextItems: unknown[], order: (number | undefined)[]) => {
    if (!statePath) return
    setState(statePath, nextItems)
    if (errorPath && errors && typeof errors === 'object') {
      const previous = errors as Record<number, unknown>
      const nextErrors: Record<number, unknown> = {}
      for (const [position, source] of order.entries())
        if (source !== undefined && previous[source] !== undefined)
          nextErrors[position] = previous[source]
      setState(errorPath, nextErrors)
    }
  }
  const add = () => {
    if (!disabled && itemCount < max) emit?.('add')
  }
  const moveTo = (index: number, target: number) => {
    if (disabled || !statePath || index === target) return
    if (index < 0 || index >= items.length || target < 0 || target >= items.length) return
    const nextItems = [...items]
    const [movedItem] = nextItems.splice(index, 1)
    nextItems.splice(target, 0, movedItem)
    const order = items.map((_, position) => position)
    const [source] = order.splice(index, 1)
    order.splice(target, 0, source)
    commitRows(nextItems, order)
  }
  const move = (index: number, direction: 'up' | 'down') =>
    moveTo(index, index + (direction === 'up' ? -1 : 1))
  const clone = (index: number) => {
    if (disabled || !statePath || itemCount >= max || index < 0 || index >= items.length) return
    const nextItems = [...items]
    const clonedItem = structuredClone(items[index])
    if (
      clonedItem !== null &&
      typeof clonedItem === 'object' &&
      !Array.isArray(clonedItem) &&
      '_key' in clonedItem
    ) {
      clonedItem._key = `${String(clonedItem._key)}-clone-${++cloneSequence}`
    }
    if (clonedItem !== null && typeof clonedItem === 'object' && '_relationKey' in clonedItem)
      delete clonedItem._relationKey
    nextItems.splice(index + 1, 0, clonedItem)
    const order: (number | undefined)[] = items.map((_, position) => position)
    order.splice(index + 1, 0, undefined)
    commitRows(nextItems, order)
  }
  const remove = (index: number) => {
    if (disabled || !statePath || itemCount <= min || index < 0 || index >= items.length) return
    commitRows(
      items.filter((_, position) => position !== index),
      items.map((_, position) => position).filter((position) => position !== index)
    )
  }
  const context: RepeaterContextValue = {
    minItems: min,
    grid: descriptor?.grid,
    maxItems: max,
    itemCount,
    reorderable: descriptor?.reorderable ?? false,
    cloneable: descriptor?.cloneable ?? false,
    collapsible: descriptor?.collapsible ?? false,
    move,
    moveTo,
    disabled,
    dragId: tableId,
    table: descriptor?.table,
    clone,
    remove,
  }
  return (
    <RepeaterContext.Provider value={context}>
      <CollectionField props={props} name={descriptor?.name ?? 'repeater'}>
        <fieldset
          disabled={disabled}
          className="min-w-0 space-y-3"
          data-repeater={descriptor?.name}
        >
          {descriptor?.table ? (
            <div
              className="max-w-full overflow-x-auto rounded-lg border border-border"
              tabIndex={0}
              role="region"
              aria-label={typeof props.label === 'string' ? props.label : t('Items')}
            >
              <table className="w-full min-w-max border-collapse bg-card text-sm text-foreground">
                <caption className="sr-only">
                  {typeof props.label === 'string' ? props.label : t('Items')}
                </caption>
                <thead className="bg-muted/40">
                  <tr>
                    {descriptor.table.map((column, position) => (
                      <th
                        key={position}
                        id={`${tableId}-${position}`}
                        scope="col"
                        className="px-3 py-3 font-medium"
                        style={{ width: column.width, textAlign: column.alignment ?? 'start' }}
                      >
                        {column.label}
                        {column.required && (
                          <span aria-hidden="true" className="ml-1 text-danger">
                            *
                          </span>
                        )}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-end font-medium">
                      {t('Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>{children}</tbody>
              </table>
            </div>
          ) : (
            children
          )}
          {itemCount === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground">
              {t('No items yet. Add an item to get started.')}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={add} disabled={disabled || itemCount >= max}>
              <Icon name="plus" />
              {descriptor?.addLabel ?? t('Add item')}
            </Button>
            {Number.isFinite(max) && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {itemCount} / {max}
              </span>
            )}
          </div>
        </fieldset>
      </CollectionField>
    </RepeaterContext.Provider>
  )
}
export default Repeater
