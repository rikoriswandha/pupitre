import type { ReactNode } from 'react'
import { Icon } from '../icons.js'
import { useBoundValue } from '@rikology/pupitre-react'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { cn } from '../primitives/index.js'
import { ActionButton } from './ActionButton.js'
type RuntimeProps = {
  props: Record<string, unknown>
  children?: ReactNode
  bindings?: Record<string, string | undefined>
}
export function Section({ props, children, bindings }: RuntimeProps) {
  const [collapsed, setCollapsed] = useBoundValue(props.collapsed === true, bindings?.collapsed)
  const className = typeof props.className === 'string' ? props.className : undefined
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
  return (
    <section
      className={cn(
        'space-y-4',
        props.compact === true
          ? 'rounded-md border border-border p-4'
          : 'border-b border-border pb-6',
        className
      )}
    >
      {(heading || typeof props.aside === 'string' || props.collapsible === true) && (
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {heading && (
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                {typeof props.icon === 'string' && <Icon name={props.icon} className="size-4" />}
                {heading}
              </h2>
            )}
            {typeof props.description === 'string' && (
              <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
            )}
          </div>
          {typeof props.aside === 'string' && (
            <span className="text-sm text-muted-foreground">{props.aside}</span>
          )}
          {props.collapsible === true && (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? 'Show' : 'Hide'}
            </button>
          )}
        </header>
      )}
      {!collapsed && (
        <div
          className={cn('min-w-0', typeof props.columns === 'number' ? 'grid gap-4' : undefined)}
          style={
            typeof props.columns === 'number'
              ? {
                  gridTemplateColumns: `repeat(${Math.max(1, Math.min(12, Math.floor(props.columns)))}, minmax(0, 1fr))`,
                }
              : undefined
          }
        >
          {children}
        </div>
      )}
      {footerActions.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          {footerActions.map((action) => (
            <ActionButton key={action.name} action={action} />
          ))}
        </div>
      )}
    </section>
  )
}
export default Section
