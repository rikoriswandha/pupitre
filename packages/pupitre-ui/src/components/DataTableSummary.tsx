import type { ColumnDescriptor, TableData } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'

type Props = { summary: NonNullable<TableData['summary']>; columns: ColumnDescriptor[] }

export function DataTableSummary({ summary, columns }: Props) {
  return (
    <div
      role="region"
      aria-label={t('Table summary')}
      className="flex flex-wrap gap-4 rounded-md border bg-muted/20 p-3 text-sm"
    >
      {Object.entries(summary).flatMap(([column, summaries]) =>
        Object.entries(summaries).map(([name, value]) => (
          <div key={`${column}-${name}`}>
            <span className="text-muted-foreground">
              {columns.find((item) => item.name === column)?.label ?? column} {name}:{' '}
            </span>
            <strong>{value}</strong>
          </div>
        ))
      )}
    </div>
  )
}
