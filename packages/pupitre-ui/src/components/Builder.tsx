import { createContext, useState, type ReactNode } from 'react'
import { useSetState, useStateValue } from '@rikology/pupitre-react'
import { Menu } from '@base-ui/react/menu'
import {
  buttonClasses,
  positionerClasses,
  popupClasses,
  menuItemClasses,
} from '../primitives/index.js'
import { Icon } from '../icons.js'
import { CollectionField } from './CollectionField.js'

type Block = { key: string; label: string; template: string; icon?: string }
type Descriptor = {
  name: string
  blocks: Block[]
  minItems?: number
  maxItems?: number
  reorderable?: boolean
  collapsible?: boolean
  cloneable?: boolean
  addLabel?: string
  blockPickerColumns?: number
}
type Item = { _key: string; type: string; data: Record<string, unknown> }
type BuilderContextValue = {
  descriptor: Descriptor
  items: Item[]
  remove: (index: number) => void
  move: (index: number, direction: -1 | 1) => void
  clone: (index: number) => void
  toggleCollapsed: (key: string) => void
  collapsed: Record<string, boolean>
  loading: boolean
}
export const BuilderContext = createContext<BuilderContextValue | null>(null)
type RuntimeProps = {
  props: Record<string, unknown>
  children?: ReactNode
  bindings?: Record<string, string | undefined>
  loading?: boolean
}
let itemSequence = 0

export function Builder({ props, children, bindings, loading = false }: RuntimeProps) {
  const descriptor = props.descriptor as Descriptor
  const path = bindings?.value?.startsWith('/data/') ? bindings.value : `/data/${descriptor.name}`
  const value = useStateValue(path)
  const items = Array.isArray(value) ? (value as Item[]) : []
  const setState = useSetState()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const max = descriptor.maxItems ?? Number.POSITIVE_INFINITY
  const update = (next: Item[]) => setState(path, next)
  const remove = (index: number) => {
    if (items.length > (descriptor.minItems ?? 0))
      update(items.filter((_item, itemIndex) => itemIndex !== index))
  }
  const move = (index: number, direction: -1 | 1) => {
    const other = index + direction
    if (other < 0 || other >= items.length) return
    const next = [...items]
    ;[next[index], next[other]] = [next[other]!, next[index]!]
    update(next)
  }
  const clone = (index: number) => {
    if (items.length >= max) return
    const copied = structuredClone(items[index]!)
    copied._key = `builder-${++itemSequence}`
    update([...items.slice(0, index + 1), copied, ...items.slice(index + 1)])
  }
  const toggleCollapsed = (key: string) => setCollapsed((old) => ({ ...old, [key]: !old[key] }))
  const canAdd = items.length < max
  return (
    <BuilderContext.Provider
      value={{ descriptor, items, remove, move, clone, toggleCollapsed, collapsed, loading }}
    >
      <CollectionField props={props} name={descriptor.name}>
        <div className="space-y-3" data-builder={descriptor.name}>
          {children}
          {items.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground">
              No blocks yet. Add a block to build your content.
            </div>
          )}
          <Menu.Root>
            <Menu.Trigger disabled={!canAdd || loading} className={buttonClasses({ size: 'sm' })}>
              <Icon name="plus" className="size-4" />
              {descriptor.addLabel ?? 'Add block'}
              <Icon name="chevron-down" className="size-4" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={6} align="start" className={positionerClasses}>
                <Menu.Popup data-pupitre-popup="" className={popupClasses}>
                  {descriptor.blocks.map((block) => (
                    <Menu.Item
                      key={block.key}
                      className={menuItemClasses}
                      aria-label={`${descriptor.addLabel ?? 'Add'} ${block.label}`}
                      onClick={() =>
                        update([
                          ...items,
                          { _key: `builder-${++itemSequence}`, type: block.key, data: {} },
                        ])
                      }
                    >
                      <Icon name={block.icon ?? 'layers'} className="size-4" />
                      {block.label}
                    </Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </CollectionField>
    </BuilderContext.Provider>
  )
}
export default Builder
