import { useContext, useState, type ReactNode } from 'react'
import { RepeaterContext } from './Repeater.js'
import { Button } from '../primitives/index.js'

type RuntimeProps = {
  props: Record<string, unknown>
  children?: ReactNode
  emit?: (event: string) => void
  loading?: boolean
}
export function RepeaterItem({ props, children, emit, loading = false }: RuntimeProps) {
  const context = useContext(RepeaterContext)
  const [collapsed, setCollapsed] = useState(props.collapsed === true)
  const index = typeof props.index === 'number' ? props.index : 0
  const label = typeof props.itemLabel === 'string' ? props.itemLabel : `Item ${index + 1}`
  const action = (event: 'remove' | 'collapse') => emit?.(event)
  return (
    <article className="min-w-0 rounded-md border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="min-w-0 truncate text-sm font-medium">{label}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {context.reorderable && (
            <>
              <Button
                type="button"
                variant="ghost"
                className="min-h-8 px-2"
                aria-label={`Move ${label} up`}
                onClick={() => context.move(index, 'up')}
                disabled={loading || index === 0}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-8 px-2"
                aria-label={`Move ${label} down`}
                onClick={() => context.move(index, 'down')}
                disabled={loading || index >= context.itemCount - 1}
              >
                ↓
              </Button>
            </>
          )}
          {context.collapsible && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-8 px-2"
              onClick={() => {
                setCollapsed((value) => !value)
                action('collapse')
              }}
              aria-expanded={!collapsed}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </Button>
          )}
          {context.cloneable && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-8 px-2"
              onClick={() => context.clone(index)}
              disabled={loading || context.itemCount >= context.maxItems}
            >
              Clone
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="min-h-8 px-2 text-destructive"
            onClick={() => action('remove')}
            disabled={loading || context.itemCount <= context.minItems}
          >
            Remove
          </Button>
        </div>
      </header>
      {!collapsed && <div className="space-y-4 p-4">{children}</div>}
    </article>
  )
}
export default RepeaterItem
