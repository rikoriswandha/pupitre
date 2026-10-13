import { lazy, Suspense } from 'react'
import type { WidgetDescriptor } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { Panel, PanelHeader, Skeleton } from '../primitives/index.js'
import type { CalendarData } from './CalendarBody.js'
const CalendarBody = lazy(() =>
  import('./CalendarBody.js').then((module) => ({ default: module.CalendarBody }))
)
export function Calendar({ descriptor, data }: { descriptor: WidgetDescriptor; data: unknown }) {
  return (
    <Panel role="region" aria-label={descriptor.heading ?? t('Calendar')}>
      <PanelHeader
        heading={descriptor.heading ?? t('Calendar')}
        description={descriptor.description}
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <CalendarBody descriptor={descriptor} data={data as CalendarData} />
      </Suspense>
    </Panel>
  )
}
