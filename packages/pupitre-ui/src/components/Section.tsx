import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { Icon } from '../icons.js'
import { t, useBoundValue, useEmbedded } from '@rikology/pupitre-react'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { Button, cn, Collapse, LedgerSection, ledgerRuleClasses } from '../primitives/index.js'
import { ActionList } from './ActionList.js'
import { InfolistContext } from './EntryShell.js'

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
  const inInfolist = useContext(InfolistContext)
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
  const aside = (
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
  )
  const header = hasHeader ? (
    <header
      data-pupitre-section-header=""
      className={cn('flex items-start justify-between gap-4 pt-3 pb-4', compact && 'pb-3')}
    >
      <div className="flex min-w-0 items-start gap-2">
        {typeof props.icon === 'string' && (
          <Icon name={props.icon} className="mt-1 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          {heading && (
            <h2
              data-pupitre-section-heading=""
              className="text-[0.9375rem] font-semibold text-foreground"
            >
              {heading}
            </h2>
          )}
          {description && (
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{aside}</div>
    </header>
  ) : null
  const columns =
    typeof props.columns === 'number' ? Math.max(1, Math.min(12, Math.floor(props.columns))) : 1
  const body = (
    <PanelNestingContext.Provider value={true}>
      <Collapse open={!collapsed}>
        <div
          data-pupitre-section-body=""
          className={cn(
            'grid min-w-0 grid-cols-1 sm:grid-cols-[repeat(var(--section-columns),minmax(0,1fr))]',
            // View pages: entries draw their own hairlines, so columns sit on a ruled grid.
            inInfolist ? 'gap-x-8' : 'gap-x-6 gap-y-5',
            !inInfolist && (compact ? 'pb-3' : 'pb-5'),
            !inInfolist && !hasHeader && 'pt-5'
          )}
          style={{ '--section-columns': columns } as CSSProperties}
        >
          {children}
        </div>
      </Collapse>
      {footerActions.length > 0 && (
        <div data-pupitre-section-footer="" className="mt-5 border-t border-border py-4">
          <ActionList actions={footerActions} align="end" />
        </div>
      )}
    </PanelNestingContext.Provider>
  )
  const className = typeof props.className === 'string' ? props.className : undefined
  if (inInfolist)
    return (
      <LedgerSection
        heading={heading}
        description={description}
        aside={aside}
        className={cn('pb-8', !hasHeader && 'pt-1', className)}
      >
        {body}
      </LedgerSection>
    )
  return (
    <section
      data-pupitre-section=""
      className={cn(
        'min-w-0',
        plain ? '[&+section]:border-t [&+section]:border-border' : ledgerRuleClasses,
        asideLayout && 'grid items-start gap-x-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]',
        className
      )}
    >
      {header}
      <div className={cn('min-w-0', asideLayout && 'pt-3')}>{body}</div>
    </section>
  )
}
export default Section
