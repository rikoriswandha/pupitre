import { ActionBar } from './ActionBar.js'
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
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{descriptor.label}</h2>
        {descriptor.badge !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{descriptor.badge}</span>
        )}
      </header>
      {!descriptor.readOnly && (
        <ActionBar props={{ actions: descriptor.actions.header }} emit={emit} />
      )}
      <DataTable props={{ descriptor: table }} emit={emit} />
    </section>
  )
}
