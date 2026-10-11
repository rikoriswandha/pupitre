import type { PanelRuntime, ResourceRuntime } from '../manager.js'
import type { PupitreConfig } from '../define_config.js'
import { resolveResourcePolicy } from '../authz/bouncer.js'
import { getComponentDefinition, schema as schemaFactory } from '../builder/schema/schema.js'
import type { SchemaNodeBuilder } from '../definition/schema.js'
import { liftClosure } from '../compiler/closure_lifter.js'
import type { SchemaNodeDefinition, FieldDefinitionUnion } from '../definition/schema.js'

export type ClosureInspection = {
  field: string
  visible?: string
  disabled?: string
  label?: string
  helperText?: string
  placeholder?: string
  afterStateUpdated?: string
}

function fieldClosures(nodes: SchemaNodeDefinition[], prefix = ''): ClosureInspection[] {
  const report: ClosureInspection[] = []
  for (const node of nodes) {
    if ('name' in node && node.name) {
      const path = [prefix, node.name].filter(Boolean).join('.')
      const field = node as FieldDefinitionUnion
      const result: ClosureInspection = { field: path }
      for (const key of ['visible', 'disabled', 'label', 'helperText', 'placeholder'] as const) {
        const value = field[key]
        if (typeof value !== 'function') continue
        result[key] = liftClosure(
          value,
          key === 'placeholder' || key === 'helperText' ? 'content' : key,
          {
            pathPrefix: '/data',
            inRepeater: prefix.split('.').some((part) => part === '*'),
          }
        ).kind
      }
      if (typeof field.afterStateUpdated === 'function')
        result.afterStateUpdated =
          typeof field.live === 'object' && field.live.server
            ? 'server'
            : liftClosure(field.afterStateUpdated, 'afterStateUpdated', {
                pathPrefix: '/data',
                inRepeater: prefix.split('.').some((part) => part === '*'),
              }).kind
      if (Object.keys(result).length > 1) report.push(result)
      if (node.kind === 'repeater') {
        const children =
          typeof node.schema === 'function'
            ? (
                node.schema(schemaFactory as never) as unknown as (
                  SchemaNodeDefinition | SchemaNodeBuilder
                )[]
              ).map((child) => {
                const builder = child as SchemaNodeBuilder
                return typeof builder.toDefinition === 'function'
                  ? getComponentDefinition(builder)
                  : (child as SchemaNodeDefinition)
              })
            : (node.schema ?? [])
        report.push(...fieldClosures(children, `${path}.*`))
      }
    }
    if ('children' in node && Array.isArray(node.children))
      report.push(...fieldClosures(node.children, prefix))
  }
  return report
}

export type PolicyInspection = {
  panel: string
  resource: string
  model: string
  policy: string | null
  allowByDefault: boolean
  requiredAbilities: string[]
  searchableColumns: string[]
  missingAbilities: string[]
  fieldClosures: ClosureInspection[]
  missingSearchableIndexes: string[]
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
  selectedResource?: string,
  inspectIndexes?: (resource: ResourceRuntime, columns: string[]) => Promise<string[]>
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
      const missingSearchableIndexes = inspectIndexes
        ? await inspectIndexes(resource, searchable)
        : []
      report.push({
        panel: panel.id,
        resource: resource.slug,
        model: resource.definition.model,
        policy: policy?.name ?? null,
        allowByDefault: !policy,
        requiredAbilities: required,
        searchableColumns: searchable,
        missingAbilities: policy ? required.filter((ability) => !available.has(ability)) : [],
        fieldClosures: resource.definition.form ? fieldClosures(resource.definition.form) : [],
        missingSearchableIndexes,
      })
    }
  }
  return report
}
