import { createContext, useState, type CSSProperties, type ReactNode } from 'react'
import { useSetState, useStateValue } from '@rikology/pupitre-react'
import { Button } from '../primitives/index.js'

type Block = { key: string; label: string; template: string }
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
  const pickerStyle =
    typeof descriptor.blockPickerColumns === 'number' && descriptor.blockPickerColumns > 0
      ? ({
          gridTemplateColumns: `repeat(${Math.floor(descriptor.blockPickerColumns)}, minmax(0, 1fr))`,
        } satisfies CSSProperties)
      : undefined
  const canAdd = items.length < max
  return (
    <BuilderContext.Provider
      value={{ descriptor, items, remove, move, clone, toggleCollapsed, collapsed, loading }}
    >
      <div className="space-y-4" data-builder={descriptor.name}>
        {children}
        <div
          className="grid gap-2"
          style={pickerStyle}
          role="group"
          aria-label={descriptor.addLabel ?? 'Add block'}
        >
          {descriptor.blocks.map((block) => (
            <Button
              key={block.key}
              type="button"
              variant="outline"
              disabled={!canAdd || loading}
              onClick={() =>
                update([...items, { _key: `builder-${++itemSequence}`, type: block.key, data: {} }])
              }
            >
              {descriptor.addLabel ?? 'Add'} {block.label}
            </Button>
          ))}
        </div>
      </div>
    </BuilderContext.Provider>
  )
}
export default Builder
