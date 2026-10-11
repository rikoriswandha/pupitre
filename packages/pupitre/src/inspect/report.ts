import type { PanelRuntime, ResourceRuntime } from '../manager.js'
import type { PupitreConfig } from '../define_config.js'
import { resolveResourcePolicy } from '../authz/bouncer.js'

export type PolicyInspection = {
  panel: string
  resource: string
  model: string
  policy: string | null
  allowByDefault: boolean
  requiredAbilities: string[]
  searchableColumns: string[]
  missingAbilities: string[]
}

function addActionAbilities(
  abilities: Set<string>,
  actions: ResourceRuntime['definition']['actions']
) {
  for (const action of [
    ...(actions?.header ?? []),
    ...(actions?.row ?? []),
    ...(actions?.bulk ?? []),
  ]) {
    if (action.can) {
      abilities.add(action.can)
      continue
    }
    if (action.builtin === 'create') abilities.add('create')
    if (action.builtin === 'edit') abilities.add('update')
    if (action.builtin === 'view') abilities.add('view')
    if (action.builtin === 'delete') abilities.add('delete')
    if (action.builtin === 'bulk' && ['delete', 'bulk-delete'].includes(action.name))
      abilities.add('delete')
  }
}

function requiredAbilities(resource: ResourceRuntime): string[] {
  const abilities = new Set<string>()
  if (resource.definition.pages.list || resource.definition.globallySearchable?.length)
    abilities.add('viewAny')
  if (resource.definition.pages.create) abilities.add('create')
  if (resource.definition.pages.edit) abilities.add('update')
  if (resource.definition.pages.view) abilities.add('view')
  abilities.add('delete')
  addActionAbilities(abilities, resource.definition.actions)
  return [...abilities].sort()
}

function searchableColumns(resource: ResourceRuntime): string[] {
  const columns = [
    ...(resource.definition.globallySearchable ?? []),
    ...(resource.definition.table?.columns.flatMap((column) =>
      'searchable' in column && column.searchable ? [column.name] : []
    ) ?? []),
  ]
  return [...new Set(columns)].sort()
}
export async function buildPolicyInspection(
  panels: PanelRuntime[],
  config?: PupitreConfig,
  selectedResource?: string
): Promise<PolicyInspection[]> {
  const report: PolicyInspection[] = []
  for (const panel of panels) {
    for (const resource of panel.resources) {
      if (selectedResource && selectedResource !== resource.slug) continue
      const policy = await resolveResourcePolicy(resource, config)
      const required = requiredAbilities(resource)
      const searchable = searchableColumns(resource)
      const available = new Set(
        policy
          ? Object.getOwnPropertyNames(policy.prototype).filter((name) => name !== 'constructor')
          : []
      )
      report.push({
        panel: panel.id,
        resource: resource.slug,
        model: resource.definition.model,
        policy: policy?.name ?? null,
        allowByDefault: !policy,
        requiredAbilities: required,
        searchableColumns: searchable,
        missingAbilities: policy ? required.filter((ability) => !available.has(ability)) : [],
      })
    }
  }
  return report
}
