import { ActionList } from './ActionList.js'
import { DataTable } from './DataTable.js'
import type { RelationDescriptor } from '@rikology/pupitre/catalog'
import { Badge } from '../primitives/index.js'

export type RelationManagerProps = {
  props: { descriptor: RelationDescriptor }
  emit: (event: string, payload?: unknown) => void
}

export function RelationManager({ props, emit }: RelationManagerProps) {
  const descriptor = props.descriptor
  const table = descriptor.readOnly
    ? { ...descriptor.table, selectable: false, bulkActions: [] }
    : descriptor.table
  return (
    <section
      aria-label={descriptor.label}
      className="space-y-4"
      data-relation={descriptor.relation}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">{descriptor.label}</h2>
          {descriptor.badge !== undefined && <Badge size="sm">{descriptor.badge}</Badge>}
        </div>
        {!descriptor.readOnly && (
          <ActionList
            actions={descriptor.actions.header}
            max={3}
            size="sm"
            onRun={(action) => emit('action', { action: action.name })}
          />
        )}
      </header>
      <DataTable props={{ descriptor: table }} emit={emit} />
    </section>
  )
}
