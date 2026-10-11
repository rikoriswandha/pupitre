import type { ComponentType } from 'react'
import type { WidgetDescriptor } from '@rikology/pupitre/catalog'
type Props = {
  descriptor: WidgetDescriptor
  component: ComponentType<{ data: unknown; descriptor: WidgetDescriptor }>
  data: unknown
}
export function WidgetCustom({ descriptor, component: Custom, data }: Props) {
  return <Custom descriptor={descriptor} data={data} />
}
