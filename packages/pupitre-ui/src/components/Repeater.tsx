import { Children, createContext, type ReactNode } from 'react'
import { t, useSetState, useStateValue } from '@rikology/pupitre-react'
import { Button } from '../primitives/index.js'
import { Icon } from '../icons.js'
import { CollectionField } from './CollectionField.js'

type RepeaterMetadata = {
  name: string
  minItems: number
  maxItems?: number
  addLabel?: string
  grid?: number | Record<string, number>
  reorderable: boolean
  cloneable: boolean
  collapsible: boolean
}
let cloneSequence = 0
type RepeaterContextValue = {
  minItems: number
  maxItems: number
  itemCount: number
  reorderable: boolean
  cloneable: boolean
  collapsible: boolean
  move: (index: number, direction: 'up' | 'down') => void
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
  clone: () => {},
  remove: () => {},
})

export function Repeater({ props, children, emit, bindings, loading = false }: RuntimeProps) {
  const descriptor = readDescriptor(props.descriptor)
  const statePath = bindings?.value?.startsWith('/data/')
    ? bindings.value
    : descriptor
      ? `/data/${descriptor.name}`
      : undefined
  const stateItems = useStateValue(statePath ?? '/data')
  const items = Array.isArray(stateItems) ? stateItems : []
  const itemCount = Array.isArray(stateItems) ? items.length : Children.count(children)
  const min = descriptor?.minItems ?? 0
  const max = descriptor?.maxItems ?? Number.POSITIVE_INFINITY
  const setState = useSetState()
  const add = () => {
    if (itemCount < max) emit?.('add')
  }
  const move = (index: number, direction: 'up' | 'down') => {
    if (!statePath) return
    const nextIndex = index + (direction === 'up' ? -1 : 1)
    if (index < 0 || index >= items.length || nextIndex < 0 || nextIndex >= items.length) return
    const nextItems = [...items]
    const movedItem = nextItems[index]
    nextItems[index] = nextItems[nextIndex]
    nextItems[nextIndex] = movedItem
    setState(statePath, nextItems)
  }
  const clone = (index: number) => {
    if (!statePath || itemCount >= max || index < 0 || index >= items.length) return
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
    nextItems.splice(index + 1, 0, clonedItem)
    setState(statePath, nextItems)
  }
  const remove = (index: number) => {
    if (!statePath || itemCount <= min || index < 0 || index >= items.length) return
    setState(
      statePath,
      items.filter((_, position) => position !== index)
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
    clone,
    remove,
  }
  return (
    <RepeaterContext.Provider value={context}>
      <CollectionField props={props} name={descriptor?.name ?? 'repeater'}>
        <div className="space-y-3" data-repeater={descriptor?.name}>
          {children}
          {itemCount === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground">
              {t('No items yet. Add an item to get started.')}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={add} disabled={loading || itemCount >= max}>
              <Icon name="plus" />
              {descriptor?.addLabel ?? t('Add item')}
            </Button>
            {Number.isFinite(max) && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {itemCount} / {max}
              </span>
            )}
          </div>
        </div>
      </CollectionField>
    </RepeaterContext.Provider>
  )
}
export default Repeater
