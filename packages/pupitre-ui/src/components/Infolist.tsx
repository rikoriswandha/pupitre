import type { ReactNode } from 'react'

export function Infolist({
  children,
  props = {},
}: {
  children?: ReactNode
  props?: { columns?: number }
}) {
  const columns = typeof props.columns === 'number' ? props.columns : 2
  return (
    <dl
      className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }}
    >
      {children}
    </dl>
  )
}
