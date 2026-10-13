import type { ColumnDescriptor, TableData } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'

type Props = { summary: NonNullable<TableData['summary']>; columns: ColumnDescriptor[] }

export function DataTableSummary({ summary, columns }: Props) {
  return (
    <div
      role="region"
      aria-label={t('Table summary')}
      // Totals close the ledger under an ink rule, like a column sum on paper.
      className="flex flex-wrap gap-x-6 gap-y-2 border-t border-rule py-3 text-[0.8125rem] tabular-nums"
    >
      {Object.entries(summary).flatMap(([column, summaries]) =>
        Object.entries(summaries).map(([name, value]) => (
          <div key={`${column}-${name}`}>
            <span className="text-muted-foreground">
              {columns.find((item) => item.name === column)?.label ?? column} {name}:{' '}
            </span>
            <strong className="font-medium text-foreground">{value}</strong>
          </div>
        ))
      )}
    </div>
  )
}
