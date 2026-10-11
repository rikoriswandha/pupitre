import type { WidgetData } from '@rikology/pupitre/catalog'
import { WidgetChartBody } from '../../../src/components/WidgetChartBody.js'

const data: WidgetData = {
  kind: 'chart',
  labels: ['Jan', 'Feb'],
  datasets: [
    { label: 'Revenue', data: [10, 20] },
    { label: 'Orders', data: [4, 8] },
  ],
}

export function ChartAccessibilityStory() {
  return <WidgetChartBody chartType="line" data={data} />
}
