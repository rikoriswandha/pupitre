import { EnvironmentIndicator } from '../../../src/components/EnvironmentIndicator.js'
import { WidgetChart } from '../../../src/components/WidgetChart.js'
import { Shell } from '../../../src/components/Shell.js'

export function CoreSmallStory({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? 'dark' : ''} style={{ width: 390 }}>
      <div className="bg-background text-foreground p-4">
        <EnvironmentIndicator environment={{ label: 'Staging', color: 'warning' }} />
      </div>
      <WidgetChart
        descriptor={{
          name: 'radar',
          kind: 'chart',
          chartType: 'radar',
          dataProp: 'radar',
          span: 1,
          sort: 0,
          heading: 'Inventory profile',
        }}
        data={{
          kind: 'chart',
          labels: ['Speed', 'Quality', 'Cost'],
          datasets: [{ label: 'Team', data: [3, 4, 5] }],
        }}
      />
      <WidgetChart
        descriptor={{
          name: 'scatter',
          kind: 'chart',
          chartType: 'scatter',
          dataProp: 'scatter',
          span: 1,
          sort: 0,
          heading: 'Price and stock',
        }}
        data={{
          kind: 'scatter',
          datasets: [
            {
              label: 'Products',
              data: [
                { x: 1, y: 2 },
                { x: 2, y: 4 },
              ],
            },
          ],
        }}
      />
    </div>
  )
}

export function CoreSmallShellStory({
  sidebar,
  dark,
}: {
  sidebar: 'expanded' | 'collapsed' | 'top-nav'
  dark: boolean
}) {
  return (
    <Shell
      panel={{
        id: 'environment-layout',
        path: '/admin',
        brand: { name: 'Operations' },
        theme: { sidebar, darkMode: dark ? 'dark' : 'light' },
        features: {},
      }}
      environment={{ label: 'Staging', color: 'warning' }}
      user={null}
      nav={[]}
      breadcrumbs={[]}
      title="Overview"
      headerActions={[]}
      currentUrl="/admin"
      tenant={null}
      tenants={[]}
    >
      <p>Panel content</p>
    </Shell>
  )
}
