import type { CSSProperties, ReactNode } from 'react'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
type ResponsiveColumns = { default?: number; sm?: number; md?: number; lg?: number; xl?: number }
function isResponsiveColumns(value: unknown): value is ResponsiveColumns {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
const validColumns = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(12, Math.floor(value)))
    : undefined

export function Grid({ props, children }: RuntimeProps) {
  const columns = props.columns
  const responsive = isResponsiveColumns(columns)
  const responsiveColumns = responsive ? columns : {}
  const customProperties = {} as Record<
    '--grid-default' | '--grid-sm' | '--grid-md' | '--grid-lg' | '--grid-xl',
    string
  >
  if (responsive) {
    for (const key of ['default', 'sm', 'md', 'lg', 'xl'] as const) {
      const count = validColumns(responsiveColumns[key])
      if (count) customProperties[`--grid-${key}` as keyof typeof customProperties] = String(count)
    }
  }
  const style = (
    responsive
      ? customProperties
      : { gridTemplateColumns: `repeat(${validColumns(columns) ?? 1}, minmax(0, 1fr))` }
  ) as CSSProperties
  const gap = typeof props.gap === 'number' ? `${Math.max(0, props.gap) * 0.25}rem` : undefined
  return (
    <div
      className="grid min-w-0 grid-cols-[repeat(var(--grid-default,1),minmax(0,1fr))] sm:grid-cols-[repeat(var(--grid-sm,var(--grid-default,1)),minmax(0,1fr))] md:grid-cols-[repeat(var(--grid-md,var(--grid-sm,var(--grid-default,1))),minmax(0,1fr))] lg:grid-cols-[repeat(var(--grid-lg,var(--grid-md,var(--grid-sm,var(--grid-default,1)))),minmax(0,1fr))] xl:grid-cols-[repeat(var(--grid-xl,var(--grid-lg,var(--grid-md,var(--grid-sm,var(--grid-default,1))))),minmax(0,1fr))]"
      style={{ ...style, gap }}
    >
      {children}
    </div>
  )
}
export default Grid
