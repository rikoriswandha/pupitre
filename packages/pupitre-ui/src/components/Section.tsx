import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { Icon } from '../icons.js'
import { t, useBoundValue, useEmbedded } from '@rikology/pupitre-react'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { Button, cn, Collapse, Panel, PanelHeader } from '../primitives/index.js'
import { ActionList } from './ActionList.js'

export const PanelNestingContext = createContext(false)
type RuntimeProps = {
  props: Record<string, unknown>
  children?: ReactNode
  bindings?: Record<string, string | undefined>
}
export function Section({ props, children, bindings }: RuntimeProps) {
  const [collapsed, setCollapsed] = useBoundValue(props.collapsed === true, bindings?.collapsed)
  const nested = useContext(PanelNestingContext)
  const embedded = useEmbedded()
  const plain = nested || embedded
  const compact = props.compact === true
  const footerActions = Array.isArray(props.footerActions)
    ? props.footerActions.filter(
        (action): action is ActionDescriptor =>
          !!action &&
          typeof action === 'object' &&
          'name' in action &&
          'label' in action &&
          typeof action.name === 'string' &&
          typeof action.label === 'string'
      )
    : []
  const heading = typeof props.heading === 'string' ? props.heading : undefined
  const description = typeof props.description === 'string' ? props.description : undefined
  const asideLayout = props.aside === true && !plain
  const hasHeader = Boolean(
    heading || description || props.icon || props.collapsible || typeof props.aside === 'string'
  )
  const header = hasHeader ? (
    <PanelHeader
      heading={heading}
      description={description}
      icon={typeof props.icon === 'string' ? props.icon : undefined}
      className={cn(plain && 'px-0 sm:px-0 pt-0', compact && !plain && 'px-4 py-3 sm:px-4')}
      aside={
        <>
          {typeof props.aside === 'string' && (
            <span className="text-[0.8125rem] text-muted-foreground">{props.aside}</span>
          )}
          {props.collapsible === true && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              square
              aria-label={collapsed ? t('Show') : t('Hide')}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
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
        </>
      }
    />
  ) : null
  const columns =
    typeof props.columns === 'number' ? Math.max(1, Math.min(12, Math.floor(props.columns))) : 1
  const body = (
    <PanelNestingContext.Provider value={true}>
      <Collapse open={!collapsed}>
        <div
          className={cn(
            'grid min-w-0 gap-x-6 gap-y-5 grid-cols-1 sm:grid-cols-[repeat(var(--section-columns),minmax(0,1fr))]',
            plain ? 'py-1' : compact ? 'p-4' : 'p-5 sm:p-6',
            hasHeader && !plain && !asideLayout && 'border-t border-border'
          )}
          style={{ '--section-columns': columns } as CSSProperties}
        >
          {children}
        </div>
      </Collapse>
      {footerActions.length > 0 && (
        <div
          className={cn(
            'border-t border-border bg-muted/30',
            plain ? 'mt-5 py-3' : 'rounded-b-xl px-5 py-4 sm:px-6'
          )}
        >
          <ActionList actions={footerActions} align="end" />
        </div>
      )}
    </PanelNestingContext.Provider>
  )
  const className = typeof props.className === 'string' ? props.className : undefined
  if (plain)
    return (
      <section className={cn('min-w-0', className)}>
        {header}
        {body}
      </section>
    )
  if (asideLayout)
    return (
      <section
        className={cn(
          'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]',
          className
        )}
      >
        <div>{header}</div>
        <Panel>{body}</Panel>
      </section>
    )
  return (
    <Panel className={className}>
      {header}
      {body}
    </Panel>
  )
}
export default Section
