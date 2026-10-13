import type { PanelRuntime } from '../manager.js'
import type { PupitreConfig } from '../define_config.js'
import { flattenRelationManagers } from '../definition/relation_manager.js'
import { resolveModelPolicy, resolveResourcePolicy } from './bouncer.js'

/** Inventory uses the same async policy resolution as request authorization. */
export async function missingPolicies(
  panel: PanelRuntime,
  config?: PupitreConfig
): Promise<string[]> {
  const missing: string[] = []
  for (const resource of panel.resources) {
    if (!(await resolveResourcePolicy(resource, config)))
      missing.push(`${panel.id}/${resource.slug} (${resource.definition.model})`)
    for (const manager of flattenRelationManagers(resource.definition.relations)) {
      const relation = resource.model.$getRelation(manager.relation)
      relation.boot()
      const model = relation.relatedModel()
      const registered = panel.resources.find((candidate) => candidate.model === model)
      const policy = registered
        ? await resolveResourcePolicy(registered, config)
        : await resolveModelPolicy(model.name, config)
      if (!policy) missing.push(`${panel.id}/${resource.slug}/${manager.relation} (${model.name})`)
    }
  }
  const widgets = [
    ...panel.widgets,
    ...panel.pages.flatMap((page) => page.definition.widgets ?? []),
    ...panel.resources.flatMap((resource) =>
      Object.values(resource.definition.pages).flatMap((page) => [
        ...(page?.widgets ?? []),
        ...(page?.footerWidgets ?? []),
      ])
    ),
  ]
  for (const widget of new Set(widgets)) {
    if (!widget.table || widget.table.records || !widget.model) continue
    const registered = panel.resources.find((resource) => resource.model === widget.model)
    if (!registered && !(await resolveModelPolicy(widget.model.name, config)))
      missing.push(`${panel.id}/widgets/${widget.name} (${widget.model.name})`)
  }
  return missing
}
