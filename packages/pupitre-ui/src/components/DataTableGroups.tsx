import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import type { ColumnDescriptor, TableData, TableDescriptor } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
type Props = {
  groups: NonNullable<TableData['groups']>
  columns: ColumnDescriptor[]
  definition?: NonNullable<TableDescriptor['groups']>[number]
  layout: TableDescriptor['layout']
  colSpan: number
  renderRows: (rows: NonNullable<TableData['groups']>[number]['rows']) => ReactNode
}

export function DataTableGroups({
  groups,
  columns,
  definition,
  layout,
  colSpan,
  renderRows,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  if (groups.length === 0) return null
  return (
    <>
      {groups.map((group) => {
        const canCollapse = definition?.collapsible ?? false
        const isCollapsed = collapsed[group.key] ?? false
        const summary = group.summary && (
          <div className="flex flex-wrap gap-3 text-[0.8125rem] tabular-nums text-muted-foreground">
            {Object.entries(group.summary).flatMap(([column, summaries]) =>
              Object.entries(summaries).map(([name, value]) => (
                <span key={`${column}-${name}`}>
                  {columns.find((item) => item.name === column)?.label ?? column} {name}:{' '}
                  <strong className="text-foreground">{value}</strong>
                </span>
              ))
            )}
          </div>
        )
        if (layout === 'grid') {
          return (
            <section key={group.key} className="grid gap-2">
              <header className="border-b border-border bg-muted/50 px-5 py-3">
                {canCollapse ? (
                  <button
                    type="button"
                    className="flex min-h-7 w-full items-center justify-between rounded text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    aria-expanded={!isCollapsed}
                    onClick={() =>
                      setCollapsed((current) => ({ ...current, [group.key]: !isCollapsed }))
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Icon
                        name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                        className="size-4 text-muted-foreground"
                      />
                      {group.label}
                    </span>
                    <span className="text-muted-foreground">
                      {group.rows.length} {t('rows')}
                    </span>
                  </button>
                ) : (
                  <h3 className="text-sm font-medium">{group.label}</h3>
                )}
                {summary && <div className="mt-2">{summary}</div>}
              </header>
              {!isCollapsed && renderRows(group.rows)}
            </section>
          )
        }
        return (
          <Fragment key={group.key}>
            <tr className="border-t border-border bg-muted/50">
              <th colSpan={colSpan} className="px-4 py-3 text-left">
                {canCollapse ? (
                  <button
                    type="button"
                    className="flex min-h-7 w-full items-center justify-between rounded text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    aria-expanded={!isCollapsed}
                    onClick={() =>
                      setCollapsed((current) => ({ ...current, [group.key]: !isCollapsed }))
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Icon
                        name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                        className="size-4 text-muted-foreground"
                      />
                      {group.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {group.rows.length} {t('rows')}
                    </span>
                  </button>
                ) : (
                  <span className="font-medium">{group.label}</span>
                )}
              </th>
            </tr>
            {!isCollapsed && renderRows(group.rows)}
            {summary && !isCollapsed && (
              <tr className="border-t border-border bg-muted/40">
                <td colSpan={colSpan} className="px-4 py-3">
                  {summary}
                </td>
              </tr>
            )}
          </Fragment>
        )
      })}
    </>
  )
}
