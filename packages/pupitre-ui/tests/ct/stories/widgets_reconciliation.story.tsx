import { useState } from 'react'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { WidgetGrid } from '../../../src/components/WidgetGrid.js'
import { WidgetStats } from '../../../src/components/WidgetStats.js'

const initialStats: WidgetData = {
  kind: 'stats',
  stats: [{ label: 'Count', value: 'Initial count' }],
}
const initialCustom: WidgetData = { kind: 'component', data: { message: 'Initial custom' } }
const widgets: WidgetDescriptor[] = [
  {
    name: 'count',
    kind: 'stats',
    dataProp: 'widget_header_count',
    dataUrl: '/admin/_pupitre/widgets/count?resource=posts&widgetPage=list',
    placement: 'header',
    span: 1,
    sort: 0,
    poll: 100,
  },
  {
    name: 'report',
    kind: 'component',
    component: 'Report',
    dataProp: 'widget_footer_report',
    dataUrl: '/admin/_pupitre/widgets/report?customPage=reports',
    placement: 'footer',
    span: 1,
    sort: 1,
    poll: 100,
  },
]
const customWidgets = {
  Report: ({ data }: { descriptor: WidgetDescriptor; data: unknown }) => {
    if (
      !data ||
      typeof data !== 'object' ||
      !('message' in data) ||
      typeof data.message !== 'string'
    )
      throw new Error('Expected custom widget message')
    return <p>{data.message}</p>
  },
}

export function WidgetReconciliationStory() {
  const [revision, setRevision] = useState(0)
  const [stats, setStats] = useState(initialStats)
  return (
    <>
      <button onClick={() => setRevision((value) => value + 1)}>Rerender wrapper</button>
      <button
        onClick={() =>
          setStats({ kind: 'stats', stats: [{ label: 'Count', value: 'Fresh count' }] })
        }
      >
        Update count prop
      </button>
      <p>Revision {revision}</p>
      <WidgetGrid
        widgets={widgets}
        data={{ widget_header_count: stats, widget_footer_report: initialCustom }}
        customWidgets={customWidgets}
      />
    </>
  )
}

export function WidgetSemanticColorsStory() {
  return (
    <WidgetStats
      descriptor={{ name: 'colors', kind: 'stats', dataProp: 'colors', span: 1, sort: 0 }}
      data={{
        kind: 'stats',
        stats: ['primary', 'success', 'warning', 'danger', 'gray', '#167a72', 'rebeccapurple'].map(
          (color) => ({ label: `${color} label`, value: `${color} value`, color })
        ),
      }}
    />
  )
}

const packedSpans: Array<number | 'full'> = [1, 1, 'full', 2, 1, 3]
export function WidgetPackingStory() {
  return (
    <div style={{ width: 1200 }}>
      <WidgetGrid
        widgets={packedSpans.map((span, index) => ({
          name: `w${index}`,
          kind: 'component',
          component: 'Box',
          dataProp: `w${index}`,
          span,
          sort: index,
        }))}
        data={Object.fromEntries(
          packedSpans.map((_, index) => [`w${index}`, { kind: 'component', data: index }])
        )}
        customWidgets={{
          Box: ({ data }: { descriptor: WidgetDescriptor; data: unknown }) => (
            <p data-testid={`widget-${String(data)}`}>Widget {String(data)}</p>
          ),
        }}
      />
    </div>
  )
}
