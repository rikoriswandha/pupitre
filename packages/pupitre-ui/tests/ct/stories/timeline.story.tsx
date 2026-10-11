import { catalogFixtures, widgetDescriptor } from '@rikology/pupitre/catalog'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { WidgetGrid } from '../../../src/components/WidgetGrid.js'
import { WidgetTimelineRenderer } from '../../../src/components/WidgetCatalogAdapters.js'

const descriptor: WidgetDescriptor = {
  name: 'activity',
  kind: 'timeline',
  dataProp: 'activity',
  heading: 'Record activity',
  description: 'Changes to this record',
  span: 'full',
  sort: 0,
}
const data: WidgetData = {
  kind: 'timeline',
  items: [
    {
      title: 'Record updated',
      description: 'Publication approved',
      actor: 'Ada',
      time: { iso: '2026-10-11T10:00:00Z', formatted: '11 Oct 2026, 10:00' },
      icon: 'check',
      color: 'success',
      changes: [
        { field: 'status', old: 'draft', new: 'published' },
        { field: 'metadata', old: null, new: { approved: true } },
        { field: 'enabled', old: false, new: true },
      ],
    },
    {
      title: 'Record created',
      time: { iso: '2026-10-10T09:00:00Z', formatted: 'Yesterday' },
      icon: 'activity',
      color: '#167a72',
    },
  ],
}
export function TimelineStory({
  empty = false,
  deferred = false,
}: {
  empty?: boolean
  deferred?: boolean
}) {
  return (
    <WidgetGrid
      widgets={[descriptor]}
      data={deferred ? {} : { activity: empty ? { kind: 'timeline', items: [] } : data }}
      deferred={deferred ? ['activity'] : []}
    />
  )
}
export function TimelineCatalogStory() {
  const props = catalogFixtures['Widget.Timeline'].elements.root.props
  return (
    <div>
      <WidgetTimelineRenderer
        props={{ ...props, descriptor: widgetDescriptor.parse(props.descriptor) }}
      />
    </div>
  )
}
