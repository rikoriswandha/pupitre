import type { CSSProperties, ReactNode } from 'react'

type Props = { children: ReactNode; columns?: { default?: number; md?: number; xl?: number } }

type GridStyle = CSSProperties & {
  '--pupitre-grid-default': string
  '--pupitre-grid-md': string
  '--pupitre-grid-xl': string
}

export function DataTableGrid({ children, columns }: Props) {
  const base = Math.max(1, columns?.default ?? 1)
  const medium = Math.max(1, columns?.md ?? 2)
  const extraLarge = Math.max(1, columns?.xl ?? 3)
  const style: GridStyle = {
    '--pupitre-grid-default': `repeat(${base}, minmax(0, 1fr))`,
    '--pupitre-grid-md': `repeat(${medium}, minmax(0, 1fr))`,
    '--pupitre-grid-xl': `repeat(${extraLarge}, minmax(0, 1fr))`,
  }
  return (
    <div className="pupitre-table-grid grid gap-4 p-4 sm:p-5" style={style}>
      {children}
    </div>
  )
}
