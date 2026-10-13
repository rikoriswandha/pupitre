import { useContext, useState, type CSSProperties, type ReactNode } from 'react'
import { t } from '@rikology/pupitre-react'
import { RepeaterContext } from './Repeater.js'
import { Button, cn, Collapse } from '../primitives/index.js'
import { Icon } from '../icons.js'
import { PanelNestingContext } from './Section.js'
import { RepeaterTableRow } from './RepeaterTableRow.js'

type RuntimeProps = {
  props: Record<string, unknown>
  children?: ReactNode
  loading?: boolean
}
export function RepeaterItem({ props, children, loading = false }: RuntimeProps) {
  const context = useContext(RepeaterContext)
  const [collapsed, setCollapsed] = useState(props.collapsed === true)
  const index = typeof props.index === 'number' ? props.index : 0
  const label =
    typeof props.itemLabel === 'string'
      ? props.itemLabel
      : t('Item {number}', { number: index + 1 })
  const gridStyle = (
    typeof context.grid === 'number'
      ? { gridTemplateColumns: `repeat(${Math.max(1, context.grid)}, minmax(0, 1fr))` }
      : Object.fromEntries(
          Object.entries(context.grid ?? {}).map(([key, count]) => [
            `--grid-${key}`,
            String(Math.max(1, Math.min(12, Math.floor(count)))),
          ])
        )
  ) as CSSProperties
  if (context.table)
    return (
      <RepeaterTableRow index={index} loading={loading}>
        {children}
      </RepeaterTableRow>
    )
  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {context.reorderable && (
            <Icon name="grip-vertical" className="size-4 shrink-0 text-muted-foreground" />
          )}
          <h3 className="min-w-0 truncate text-sm font-medium">{label}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {context.reorderable && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                square
                aria-label={t('Move {label} up', { label })}
                onClick={() => context.move(index, 'up')}
                disabled={loading || index === 0}
              >
                <Icon name="arrow-up" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                square
                aria-label={t('Move {label} down', { label })}
                onClick={() => context.move(index, 'down')}
                disabled={loading || index >= context.itemCount - 1}
              >
                <Icon name="arrow-down" className="size-4" />
              </Button>
            </>
          )}
          {context.collapsible && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              square
              aria-label={collapsed ? t('Expand') : t('Collapse')}
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
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
          {context.cloneable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              square
              aria-label={t('Clone')}
              onClick={() => context.clone(index)}
              disabled={loading || context.itemCount >= context.maxItems}
            >
              <Icon name="copy" className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            square
            color="danger"
            aria-label={t('Remove')}
            onClick={() => context.remove(index)}
            disabled={loading || context.itemCount <= context.minItems}
          >
            <Icon name="trash-2" className="size-4" />
          </Button>
        </div>
      </header>
      <Collapse open={!collapsed}>
        <div
          data-repeater-fields
          className={
            context.grid === undefined
              ? 'space-y-5 border-t border-border p-4'
              : 'grid min-w-0 gap-x-6 gap-y-5 border-t border-border p-4 grid-cols-[repeat(var(--grid-default,1),minmax(0,1fr))] sm:grid-cols-[repeat(var(--grid-sm,var(--grid-default,1)),minmax(0,1fr))] md:grid-cols-[repeat(var(--grid-md,var(--grid-sm,var(--grid-default,1))),minmax(0,1fr))] lg:grid-cols-[repeat(var(--grid-lg,var(--grid-md,var(--grid-sm,var(--grid-default,1)))),minmax(0,1fr))] xl:grid-cols-[repeat(var(--grid-xl,var(--grid-lg,var(--grid-md,var(--grid-sm,var(--grid-default,1))))),minmax(0,1fr))]'
          }
          style={gridStyle}
        >
          <PanelNestingContext.Provider value={true}>{children}</PanelNestingContext.Provider>
        </div>
      </Collapse>
    </article>
  )
}
export default RepeaterItem
