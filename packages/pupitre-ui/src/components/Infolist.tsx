import {
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { t } from '@rikology/pupitre-react'
import { Button, cn, ledgerRuleClasses } from '../primitives/index.js'
import { PanelNestingContext } from './Section.js'
import { InfolistContext, InlineEntryLabelContext } from './EntryShell.js'

type Props = Infer<typeof components.Infolist.props> & {
  columns?: number | Record<string, number>
  inlineLabel?: boolean
  className?: string
}

/**
 * A record page as a ruled sheet: entries are hairline-ruled lines on the canvas, sections
 * open with the ledger rule, and empty fields fold behind one toggle so real data reads first.
 */
export function Infolist({ props = {}, children }: { props?: Props; children?: ReactNode }) {
  const insidePanel = useContext(PanelNestingContext)
  const inheritedInlineLabel = useContext(InlineEntryLabelContext)
  const gridRef = useRef<HTMLDivElement>(null)
  const [emptyCount, setEmptyCount] = useState(0)
  const [showEmpty, setShowEmpty] = useState(false)
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const count = () => setEmptyCount(grid.querySelectorAll('[data-entry-empty]').length)
    count()
    // Live values (polling, partial reloads) can fill or clear entries after mount.
    const observer = new MutationObserver(count)
    observer.observe(grid, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-entry-empty'],
    })
    return () => observer.disconnect()
  }, [])
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
  // Folding only pays off once several fields are empty; one dimmed dash is fine inline.
  const folding = emptyCount >= 3 && !showEmpty
  return (
    <InlineEntryLabelContext.Provider value={props.inlineLabel ?? inheritedInlineLabel}>
      <InfolistContext.Provider value={true}>
        <PanelNestingContext.Provider value={true}>
          <div
            className={cn(
              'min-w-0',
              // Sections bring their own rule; a flat list of entries opens with the sheet's.
              !insidePanel && cn(ledgerRuleClasses, 'pt-1 [&:has(>div>section)]:border-t-0'),
              props.className
            )}
          >
            <div
              ref={gridRef}
              className={cn(
                'grid min-w-0 gap-x-8 grid-cols-[repeat(var(--entry-cols),minmax(0,1fr))] sm:grid-cols-[repeat(var(--entry-cols-sm),minmax(0,1fr))] md:grid-cols-[repeat(var(--entry-cols-md),minmax(0,1fr))] lg:grid-cols-[repeat(var(--entry-cols-lg),minmax(0,1fr))] xl:grid-cols-[repeat(var(--entry-cols-xl),minmax(0,1fr))]',
                folding && '[&_[data-entry-empty]]:hidden'
              )}
              style={style}
            >
              {children}
            </div>
            {emptyCount >= 3 && (
              <Button
                type="button"
                variant="link"
                className="mt-3 text-[0.8125rem]"
                aria-expanded={showEmpty}
                onClick={() => setShowEmpty(!showEmpty)}
              >
                {showEmpty
                  ? t('Hide empty fields')
                  : t('Show {count} empty fields', { count: emptyCount })}
              </Button>
            )}
          </div>
        </PanelNestingContext.Provider>
      </InfolistContext.Provider>
    </InlineEntryLabelContext.Provider>
  )
}
