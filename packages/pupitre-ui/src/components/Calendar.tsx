import { lazy, Suspense, useContext } from 'react'
import type { WidgetDescriptor } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { LedgerSection, Skeleton } from '../primitives/index.js'
import { PanelNestingContext } from './Section.js'
import type { CalendarData } from './CalendarBody.js'
const CalendarBody = lazy(() =>
  import('./CalendarBody.js').then((module) => ({ default: module.CalendarBody }))
)
export function Calendar({ descriptor, data }: { descriptor: WidgetDescriptor; data: unknown }) {
  const nested = useContext(PanelNestingContext)
  const Surface = nested ? 'section' : LedgerSection
  return (
    <Surface
      role="region"
      aria-label={descriptor.heading ?? t('Calendar')}
      {...(!nested && {
        heading: descriptor.heading ?? t('Calendar'),
        description: descriptor.description,
      })}
    >
      <Suspense fallback={<Skeleton className="h-96" />}>
        <CalendarBody descriptor={descriptor} data={data as CalendarData} />
      </Suspense>
    </Surface>
  )
}
