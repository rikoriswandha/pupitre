import { lazy, Suspense } from 'react'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
const ChartBody = lazy(() =>
  import('./WidgetChartBody.js').then((module) => ({ default: module.WidgetChartBody }))
)
type Props = { descriptor: WidgetDescriptor; data?: WidgetData }
export function WidgetChart({ descriptor, data }: Props) {
  return (
    <section aria-label={descriptor.heading ?? 'Chart'} className="rounded-lg border bg-card p-4">
      {(descriptor.heading || descriptor.description) && (
        <header className="mb-4">
          <h2 className="font-semibold">{descriptor.heading}</h2>
          {descriptor.description && (
            <p className="text-sm text-muted-foreground">{descriptor.description}</p>
          )}
        </header>
      )}
      <Suspense fallback={<div aria-busy="true" className="h-64 animate-pulse rounded bg-muted" />}>
        <ChartBody chartType={descriptor.chartType ?? 'line'} data={data} />
      </Suspense>
      {data?.kind === 'chart' && (
        <div className="sr-only">
          <table>
            <caption>{descriptor.heading ?? 'Chart'} data</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
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
    </section>
  )
}
