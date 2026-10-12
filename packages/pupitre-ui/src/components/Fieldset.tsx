import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../primitives/index.js'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Fieldset({ props, children }: RuntimeProps) {
  const className = typeof props.className === 'string' ? props.className : undefined
  const columns =
    typeof props.columns === 'number'
      ? Math.max(1, Math.min(6, Math.floor(props.columns)))
      : undefined
  return (
    <fieldset
      disabled={props.disabled === true}
      className={cn('min-w-0 space-y-5 rounded-lg border border-border p-4 sm:p-5', className)}
    >
      {typeof props.label === 'string' && (
        <legend className="mb-3 px-1 text-sm font-semibold text-foreground">{props.label}</legend>
      )}
      {typeof props.helperText === 'string' && (
        <p className="text-[0.8125rem] text-muted-foreground">{props.helperText}</p>
      )}
      <div
        className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-[repeat(var(--fieldset-columns),minmax(0,1fr))]"
        style={{ '--fieldset-columns': columns ?? 1 } as CSSProperties}
      >
        {children}
      </div>
    </fieldset>
  )
}
export default Fieldset
