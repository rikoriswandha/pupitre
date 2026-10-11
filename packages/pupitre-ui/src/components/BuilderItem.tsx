import { useContext, type ReactNode } from 'react'
import { BuilderContext } from './Builder.js'
import { Button } from '../primitives/index.js'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode; loading?: boolean }
export function BuilderItem({ props, children, loading = false }: RuntimeProps) {
  const builder = useContext(BuilderContext)
  if (!builder) return null
  const block = typeof props.block === 'string' ? props.block : ''
  const index = typeof props.index === 'number' ? props.index : -1
  const item = builder.items[index]
  if (!item || item.type !== block) return null
  const label =
    builder.descriptor.blocks.find((candidate) => candidate.key === item.type)?.label ?? item.type
  const collapsed = builder.collapsed[item._key] === true
  const busy = loading || builder.loading
  return (
    <article key={item._key} className="rounded-md border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium">{label}</h3>
        <div className="flex gap-1">
          {builder.descriptor.reorderable && (
            <>
              <Button
                type="button"
                variant="outline"
                aria-label={`Move block ${index + 1} up`}
                disabled={index === 0 || busy}
                onClick={() => builder.move(index, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label={`Move block ${index + 1} down`}
                disabled={index === builder.items.length - 1 || busy}
                onClick={() => builder.move(index, 1)}
              >
                ↓
              </Button>
            </>
          )}
          {builder.descriptor.cloneable && (
            <Button
              type="button"
              variant="outline"
              aria-label={`Clone block ${index + 1}`}
              disabled={
                busy ||
                builder.items.length >= (builder.descriptor.maxItems ?? Number.POSITIVE_INFINITY)
              }
              onClick={() => builder.clone(index)}
            >
              Clone
            </Button>
          )}
          {builder.descriptor.collapsible && (
            <Button
              type="button"
              variant="outline"
              aria-label={`Toggle block ${index + 1}`}
              aria-expanded={!collapsed}
              onClick={() => builder.toggleCollapsed(item._key)}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            aria-label={`Remove block ${index + 1}`}
            disabled={busy || builder.items.length <= (builder.descriptor.minItems ?? 0)}
            onClick={() => builder.remove(index)}
          >
            Remove
          </Button>
        </div>
      </header>
      {!collapsed && <div className="space-y-4 p-4">{children}</div>}
    </article>
  )
}
export default BuilderItem
