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
    <div
      className="min-w-0 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground"
      aria-live="polite"
    >
      {output}
    </div>
  )
}
export default Placeholder
