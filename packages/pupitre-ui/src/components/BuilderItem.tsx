import { useContext, type ReactNode } from 'react'
import { t } from '@rikology/pupitre-react'
import { BuilderContext } from './Builder.js'
import { Button, cn, Collapse } from '../primitives/index.js'
import { Icon } from '../icons.js'
import { PanelNestingContext } from './Section.js'

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
    <article key={item._key} className="min-w-0 border-t border-border">
      <header className="flex items-center justify-between gap-3 pt-3 pb-4">
        <div className="flex min-w-0 items-center gap-2">
          {builder.descriptor.reorderable && (
            <Icon name="grip-vertical" className="size-4 shrink-0 text-muted-foreground" />
          )}
          <h3 className="truncate text-[0.9375rem] font-semibold">{label}</h3>
          <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
        </div>
        <div className="flex gap-1">
          {builder.descriptor.reorderable && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                square
                aria-label={t('Move block {number} up', { number: index + 1 })}
                disabled={index === 0 || busy}
                onClick={() => builder.move(index, -1)}
              >
                <Icon name="arrow-up" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                square
                aria-label={t('Move block {number} down', { number: index + 1 })}
                disabled={index === builder.items.length - 1 || busy}
                onClick={() => builder.move(index, 1)}
              >
                <Icon name="arrow-down" className="size-4" />
              </Button>
            </>
          )}
          {builder.descriptor.cloneable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              square
              aria-label={t('Clone block {number}', { number: index + 1 })}
              disabled={
                busy ||
                builder.items.length >= (builder.descriptor.maxItems ?? Number.POSITIVE_INFINITY)
              }
              onClick={() => builder.clone(index)}
            >
              <Icon name="copy" className="size-4" />
            </Button>
          )}
          {builder.descriptor.collapsible && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              square
              aria-label={t('Toggle block {number}', { number: index + 1 })}
              aria-expanded={!collapsed}
              onClick={() => builder.toggleCollapsed(item._key)}
            >
              <Icon
                name="chevron-down"
                className={cn(
                  'size-4 transition-transform duration-200 ease-ui',
                  !collapsed && 'rotate-180'
                )}
              />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            square
            color="danger"
            aria-label={t('Remove block {number}', { number: index + 1 })}
            disabled={busy || builder.items.length <= (builder.descriptor.minItems ?? 0)}
            onClick={() => builder.remove(index)}
          >
            <Icon name="trash-2" className="size-4" />
          </Button>
        </div>
      </header>
      <Collapse open={!collapsed}>
        <div className="grid gap-x-6 gap-y-5 pb-5">
          <PanelNestingContext.Provider value={true}>{children}</PanelNestingContext.Provider>
        </div>
      </Collapse>
    </article>
  )
}
export default BuilderItem
