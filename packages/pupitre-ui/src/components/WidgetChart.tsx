import { lazy, Suspense } from 'react'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { LedgerSection, Skeleton } from '../primitives/index.js'
const ChartBody = lazy(() =>
  import('./WidgetChartBody.js').then((module) => ({ default: module.WidgetChartBody }))
)
type Props = { descriptor: WidgetDescriptor; data?: WidgetData }
export function WidgetChart({ descriptor, data }: Props) {
  return (
    <LedgerSection
      role="region"
      aria-label={descriptor.heading ?? t('Chart')}
      heading={descriptor.heading}
      description={descriptor.description}
      className={descriptor.heading || descriptor.description ? undefined : 'pt-4'}
    >
      <Suspense fallback={<Skeleton className="h-64" />}>
        <ChartBody chartType={descriptor.chartType ?? 'line'} data={data} />
      </Suspense>
      {data?.kind === 'scatter' && (
        <div className="sr-only">
          <table>
            <caption>{t('{label} data', { label: descriptor.heading ?? t('Chart') })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('Series')}</th>
                <th scope="col">X</th>
                <th scope="col">Y</th>
              </tr>
            </thead>
            <tbody>
              {data.datasets.flatMap((dataset) =>
                dataset.data.map((point, index) => (
                  <tr key={`${dataset.label}-${index}`}>
                    <th scope="row">{dataset.label}</th>
                    <td>{point.x}</td>
                    <td>{point.y}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
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
    </LedgerSection>
  )
}
