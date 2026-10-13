export type TableViewDefinition = {
  name: string
  icon?: string
  query: Record<string, unknown>
  columns?: Record<string, boolean>
  isDefault?: boolean
}
export interface TableViewBuilder {
  toDefinition(): TableViewDefinition
  icon(value: string): TableViewBuilder
  query(value: Record<string, unknown>): TableViewBuilder
  columns(value: Record<string, boolean>): TableViewBuilder
  default(value?: boolean): TableViewBuilder
}
