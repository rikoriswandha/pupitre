import { tableData as tableDataSchema } from '@rikology/pupitre/catalog'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { DataTable } from './DataTable.js'
import { LedgerSection } from '../primitives/index.js'
import { ActionBar } from './ActionBar.js'
import { PanelNestingContext } from './Section.js'

type Props = { descriptor: WidgetDescriptor; data?: WidgetData }

export function WidgetTable({ descriptor, data }: Props) {
  if (!descriptor.table) return null
  const parsed = data?.kind === 'table' ? tableDataSchema.safeParse(data.data) : undefined
  return (
    <LedgerSection
      role="region"
      aria-label={descriptor.heading ?? t('Table')}
      heading={descriptor.heading}
      description={descriptor.description}
      aside={
        descriptor.table.headerActions?.length ? (
          <ActionBar props={{ actions: descriptor.table.headerActions }} emit={() => {}} />
        ) : undefined
      }
    >
      {/* The section rule already opens the table; nested tables skip their own. */}
      <PanelNestingContext.Provider value={true}>
        <DataTable
          props={{ descriptor: descriptor.table }}
          tableData={parsed?.success ? parsed.data : undefined}
          emit={() => {}}
        />
      </PanelNestingContext.Provider>
    </LedgerSection>
  )
}
