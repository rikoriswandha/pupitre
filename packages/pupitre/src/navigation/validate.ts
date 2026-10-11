import type { PanelRuntime } from '../manager.js'
import type { NavEntryDefinition } from '../definition/navigation.js'

export function validateNavigation(panel: PanelRuntime): void {
  const resourceSlugs = new Set(panel.resources.map((resource) => resource.slug))
  const pageSlugs = new Set(panel.pages.map((page) => page.slug))
  for (const raw of panel.navigation ?? []) {
    const entry =
      typeof raw === 'object' && 'toDefinition' in raw && typeof raw.toDefinition === 'function'
        ? raw.toDefinition()
        : raw
    if (entry.type === 'group') {
      for (const item of entry.items) validateItem(panel.id, resourceSlugs, pageSlugs, item)
    } else {
      validateItem(panel.id, resourceSlugs, pageSlugs, entry)
    }
  }
}

function validateItem(
  panelId: string,
  resources: Set<string>,
  pages: Set<string>,
  item: Exclude<NavEntryDefinition, { type: 'group' }>
) {
  if (item.resource && !resources.has(item.resource) && !pages.has(item.resource)) {
    throw new Error(`Unknown Pupitre navigation slug "${item.resource}" in panel "${panelId}"`)
  }
  if (item.page && !pages.has(item.page)) {
    throw new Error(`Unknown Pupitre navigation page slug "${item.page}" in panel "${panelId}"`)
  }
}
