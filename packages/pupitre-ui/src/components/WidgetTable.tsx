import { tableData as tableDataSchema } from '@rikology/pupitre/catalog'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { DataTable } from './DataTable.js'

type Props = { descriptor: WidgetDescriptor; data?: WidgetData }

export function WidgetTable({ descriptor, data }: Props) {
  if (!descriptor.table) return null
  const parsed = data?.kind === 'table' ? tableDataSchema.safeParse(data.data) : undefined
  return (
    <section className="space-y-3">
      {(descriptor.heading || descriptor.description) && (
        <header>
          {descriptor.heading && <h2 className="font-semibold">{descriptor.heading}</h2>}
          {descriptor.description && (
            <p className="text-sm text-muted-foreground">{descriptor.description}</p>
          )}
        </header>
      )}
      <DataTable
        props={{ descriptor: descriptor.table }}
        tableData={parsed?.success ? parsed.data : undefined}
        emit={() => {}}
      />
    </section>
  )
}
