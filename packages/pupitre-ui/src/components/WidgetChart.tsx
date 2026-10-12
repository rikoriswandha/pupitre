import { lazy, Suspense } from 'react'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { Panel, PanelHeader, Skeleton } from '../primitives/index.js'
const ChartBody = lazy(() =>
  import('./WidgetChartBody.js').then((module) => ({ default: module.WidgetChartBody }))
)
type Props = { descriptor: WidgetDescriptor; data?: WidgetData }
export function WidgetChart({ descriptor, data }: Props) {
  return (
    <Panel role="region" aria-label={descriptor.heading ?? t('Chart')} className="overflow-hidden">
      {(descriptor.heading || descriptor.description) && (
        <PanelHeader heading={descriptor.heading} description={descriptor.description} />
      )}
      <div className="px-3 pb-5 pt-2 sm:px-5 sm:pb-6">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ChartBody chartType={descriptor.chartType ?? 'line'} data={data} />
        </Suspense>
      </div>
      {data?.kind === 'chart' && (
        <div className="sr-only">
          <table>
            <caption>{t('{label} data', { label: descriptor.heading ?? t('Chart') })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('Period')}</th>
                {data.datasets.map((dataset, index) => (
                  <th scope="col" key={index}>
                    {dataset.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.labels.map((label, index) => (
                <tr key={index}>
                  <th scope="row">{label}</th>
                  {data.datasets.map((dataset, seriesIndex) => (
                    <td key={seriesIndex}>{dataset.data[index] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
