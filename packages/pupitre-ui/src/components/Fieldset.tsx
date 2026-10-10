import type { ReactNode } from 'react'
import { cn } from '../primitives/index.js'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Fieldset({ props, children }: RuntimeProps) {
  const className = typeof props.className === 'string' ? props.className : undefined
  const columns =
    typeof props.columns === 'number'
      ? Math.max(1, Math.min(6, Math.floor(props.columns)))
      : undefined
  return (
    <fieldset disabled={props.disabled === true} className={cn('min-w-0 space-y-4', className)}>
      {typeof props.label === 'string' && (
        <legend className="mb-3 px-1 text-sm font-semibold text-foreground">{props.label}</legend>
      )}
      {typeof props.helperText === 'string' && (
        <p className="text-sm text-muted-foreground">{props.helperText}</p>
      )}
      <div
        className="grid gap-4"
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {children}
      </div>
    </fieldset>
  )
}
export default Fieldset
