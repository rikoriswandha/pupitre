import type { ReactNode } from 'react'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Placeholder({ props, children }: RuntimeProps) {
  const value = props.content
  const content =
    value === null || value === undefined
      ? children
      : typeof value === 'boolean'
        ? String(value)
        : typeof value === 'object'
          ? ''
          : String(value)
  const output =
    content === null || content === undefined || content === '' ? 'No content available' : content
  return (
    <div className="min-w-0 space-y-1.5 text-sm text-muted-foreground" aria-live="polite">
      {typeof props.label === 'string' && (
        <p className="font-medium text-foreground">{props.label}</p>
      )}
      {output}
    </div>
  )
}
export default Placeholder
