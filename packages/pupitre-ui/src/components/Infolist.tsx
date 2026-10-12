import { useContext, type CSSProperties, type ReactNode } from 'react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { cn, Panel } from '../primitives/index.js'
import { PanelNestingContext } from './Section.js'
import { InlineEntryLabelContext } from './EntryShell.js'

type Props = Infer<typeof components.Infolist.props> & {
  columns?: number | Record<string, number>
  inlineLabel?: boolean
  className?: string
}

export function Infolist({ props = {}, children }: { props?: Props; children?: ReactNode }) {
  const insidePanel = useContext(PanelNestingContext)
  const inheritedInlineLabel = useContext(InlineEntryLabelContext)
  const columns = props.columns ?? 2
  const responsive = typeof columns === 'object' ? columns : { default: 1, sm: columns }
  const columnCount = (count?: number) => Math.max(1, Math.min(12, Math.floor(count ?? 1)))
  const style = {
    '--entry-cols': columnCount(responsive.default),
    '--entry-cols-sm': columnCount(responsive.sm ?? responsive.default),
    '--entry-cols-md': columnCount(responsive.md ?? responsive.sm ?? responsive.default),
    '--entry-cols-lg': columnCount(
      responsive.lg ?? responsive.md ?? responsive.sm ?? responsive.default
    ),
    '--entry-cols-xl': columnCount(
      responsive.xl ?? responsive.lg ?? responsive.md ?? responsive.sm ?? responsive.default
    ),
  } as CSSProperties
  const body = (
    <InlineEntryLabelContext.Provider value={props.inlineLabel ?? inheritedInlineLabel}>
      <div
        className={cn(
          'grid min-w-0 grid-cols-[repeat(var(--entry-cols),minmax(0,1fr))] gap-x-6 gap-y-5 sm:grid-cols-[repeat(var(--entry-cols-sm),minmax(0,1fr))] md:grid-cols-[repeat(var(--entry-cols-md),minmax(0,1fr))] lg:grid-cols-[repeat(var(--entry-cols-lg),minmax(0,1fr))] xl:grid-cols-[repeat(var(--entry-cols-xl),minmax(0,1fr))]',
          !insidePanel && 'p-5 sm:p-6',
          props.className
        )}
        style={style}
      >
        {children}
      </div>
    </InlineEntryLabelContext.Provider>
  )
  return insidePanel ? (
    body
  ) : (
    <PanelNestingContext.Provider value={true}>
      <Panel>{body}</Panel>
    </PanelNestingContext.Provider>
  )
}
