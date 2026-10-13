import { ActionList } from './ActionList.js'
import { DataTable } from './DataTable.js'
import type { RelationDescriptor } from '@rikology/pupitre/catalog'

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
      {/* The relation tab already names the table; keep the heading for screen readers and
          show the row only when it carries header actions. */}
      <h2 className="sr-only">{descriptor.label}</h2>
      {!descriptor.readOnly && descriptor.actions.header.some((action) => action.enabled) && (
        <header className="flex flex-wrap items-center justify-end gap-3">
          <ActionList
            actions={descriptor.actions.header}
            max={3}
            size="sm"
            onRun={(action) => emit('action', { action: action.name })}
          />
        </header>
      )}
      <DataTable props={{ descriptor: table }} emit={emit} />
    </section>
  )
}
