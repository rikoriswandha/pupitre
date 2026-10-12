import { tableData as tableDataSchema } from '@rikology/pupitre/catalog'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { DataTable } from './DataTable.js'
import { Panel, PanelHeader } from '../primitives/index.js'

type Props = { descriptor: WidgetDescriptor; data?: WidgetData }

export function WidgetTable({ descriptor, data }: Props) {
  if (!descriptor.table) return null
  const parsed = data?.kind === 'table' ? tableDataSchema.safeParse(data.data) : undefined
  return (
    <Panel
      role="region"
      aria-label={descriptor.heading ?? t('Table')}
      className="overflow-hidden [&_.shadow-panel]:rounded-none [&_.shadow-panel]:border-0 [&_.shadow-panel]:shadow-none"
    >
      {(descriptor.heading || descriptor.description) && (
        <PanelHeader heading={descriptor.heading} description={descriptor.description} />
      )}
      <DataTable
        props={{ descriptor: descriptor.table }}
        tableData={parsed?.success ? parsed.data : undefined}
        emit={() => {}}
      />
    </Panel>
  )
}
