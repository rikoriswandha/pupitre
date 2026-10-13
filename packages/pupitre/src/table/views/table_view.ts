import type { TableViewBuilder, TableViewDefinition } from '../../definition/table_view.js'
export type { TableViewBuilder, TableViewDefinition } from '../../definition/table_view.js'
function build(value: TableViewDefinition): TableViewBuilder {
  return {
    toDefinition: () => structuredClone(value),
    icon: (icon) => build({ ...value, icon }),
    query: (query) => build({ ...value, query: structuredClone(query) }),
    columns: (columns) => build({ ...value, columns: { ...columns } }),
    default: (isDefault = true) => build({ ...value, isDefault }),
  }
}
export function tableView(name: string): TableViewBuilder {
  return build({ name, query: {} })
}
