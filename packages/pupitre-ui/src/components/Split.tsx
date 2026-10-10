import type { CSSProperties, ReactNode } from 'react'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Split({ props, children }: RuntimeProps) {
  const breakpoint = props.from === 'lg' ? 'lg' : 'md'
  const ratio =
    typeof props.ratio === 'number' && Number.isFinite(props.ratio)
      ? Math.max(0.2, Math.min(0.8, props.ratio))
      : 0.5
  const style = {
    '--split-ratio': `${ratio}fr`,
    '--split-remainder': `${1 - ratio}fr`,
  } as CSSProperties
  return (
    <div
      className={`grid min-w-0 grid-cols-1 gap-6 ${breakpoint}:grid-cols-[minmax(0,var(--split-ratio,1fr))_minmax(0,var(--split-remainder,1fr))]`}
      style={style}
    >
      {children}
    </div>
  )
}
export default Split
