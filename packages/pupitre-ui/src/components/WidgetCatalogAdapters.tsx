import type { ReactNode } from 'react'
import {
  widgetData as widgetDataSchema,
  widgetDescriptor as widgetDescriptorSchema,
} from '@rikology/pupitre/catalog'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { WidgetChart } from './WidgetChart.js'
import { WidgetStats } from './WidgetStats.js'
import { WidgetTable } from './WidgetTable.js'

type Props = {
  props: { descriptor: WidgetDescriptor; data?: unknown }
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  loading?: boolean
}

function widgetParts(props: Props['props']): { descriptor: WidgetDescriptor; data?: WidgetData } {
  const descriptor = widgetDescriptorSchema.parse(props.descriptor)
  return {
    descriptor,
    ...(props.data === undefined ? {} : { data: widgetDataSchema.parse(props.data) }),
  }
}

export function WidgetStatsRenderer({ props }: Props) {
  const widget = widgetParts(props)
  return <WidgetStats {...widget} />
}

export function WidgetChartRenderer({ props }: Props) {
  const widget = widgetParts(props)
  return <WidgetChart {...widget} />
}

export function WidgetTableRenderer({ props }: Props) {
  const widget = widgetParts(props)
  return <WidgetTable {...widget} />
}
