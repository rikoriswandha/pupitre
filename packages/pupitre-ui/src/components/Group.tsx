import type { ReactNode } from 'react'
import { cn } from '../primitives/index.js'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Group({ props, children }: RuntimeProps) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-5',
        typeof props.className === 'string' ? props.className : undefined
      )}
      data-relationship={typeof props.relationship === 'string' ? props.relationship : undefined}
    >
      {typeof props.label === 'string' && (
        <h3 className="text-sm font-medium text-foreground">{props.label}</h3>
      )}
      {typeof props.helperText === 'string' && (
        <p className="text-[0.8125rem] text-muted-foreground">{props.helperText}</p>
      )}
      {children}
    </div>
  )
}
export default Group
