import type { HttpContext } from '@adonisjs/core/http'
import { authorizeResource } from '../authz/bouncer.js'
import type { NavGroup, NavItem } from '../../catalog/wire.js'
import type { NavEntryDefinition, NavItemDefinition } from '../definition/navigation.js'
import type { PageRuntime, ResourceRuntime } from '../manager.js'

function definitionOf(
  value: NavEntryDefinition | { toDefinition(): NavEntryDefinition }
): NavEntryDefinition {
  return typeof value === 'object' && 'toDefinition' in value ? value.toDefinition() : value
}

function resourceFor(resources: ResourceRuntime[], slug: string) {
  return resources.find((resource) => resource.slug === slug)
}

function pageFor(pages: PageRuntime[], slug: string) {
  return pages.find((page) => page.slug === slug)
}

function matches(url: string, currentUrl: string) {
  return currentUrl === url || currentUrl.startsWith(`${url}/`)
}

async function renderItem(
  ctx: HttpContext,
  definition: NavItemDefinition,
  currentUrl: string
): Promise<NavItem | null> {
  if (definition.visible === false) return null
  if (typeof definition.visible === 'function' && !(await definition.visible(ctx))) return null
  let label = definition.label ?? ''
  let url = definition.url
  let icon = definition.icon
  if (definition.resource) {
    const resource = resourceFor(ctx.pupitre.panel.resources, definition.resource)
    if (resource) {
      if (!(await authorizeResource(ctx, resource, 'viewAny'))) return null
      label ||= resource.pluralLabel
      url = resource.urls.list
      icon ??= resource.definition.icon
    } else {
      const page = pageFor(ctx.pupitre.panel.pages, definition.resource)
      if (!page || (page.definition.canAccess && !(await page.definition.canAccess(ctx))))
        return null
      label ||= page.definition.navigation?.label ?? page.definition.title
      url = page.url
      icon ??= page.definition.icon
    }
  } else if (definition.page) {
    const page = pageFor(ctx.pupitre.panel.pages, definition.page)
    if (!page || (page.definition.canAccess && !(await page.definition.canAccess(ctx)))) return null
    label ||= page.definition.navigation?.label ?? page.definition.title
    url = page.url
    icon ??= page.definition.icon
  }
  let badge: string | number | null | undefined = definition.badge as
    string | number | null | undefined
  if (typeof definition.badge === 'function') badge = await definition.badge(ctx)
  return {
    label: label || url || 'Navigation',
    ...(url ? { url } : {}),
    ...(icon ? { icon } : {}),
    ...(typeof badge === 'string' || typeof badge === 'number' ? { badge } : {}),
    ...(definition.external ? { external: true } : {}),
    ...(url ? { active: !definition.external && matches(url, currentUrl) } : {}),
  }
}

export async function buildNavigation(ctx: HttpContext): Promise<NavGroup[]> {
  const panel = ctx.pupitre.panel
  const currentUrl = ctx.request.url().split('?')[0]
  if (panel.navigation) {
    const result: { group: NavGroup; sort: number }[] = []
    for (const entry of panel.navigation.map(definitionOf)) {
      if (entry.type === 'group') {
        const items: { item: NavItem; sort: number }[] = []
        for (const definition of entry.items) {
          const item = await renderItem(ctx, definition, currentUrl)
          if (item) items.push({ item, sort: definition.sort ?? 0 })
        }
        items.sort((a, b) => a.sort - b.sort || a.item.label.localeCompare(b.item.label))
        if (items.length)
          result.push({
            group: {
              label: entry.label,
              items: items.map(({ item }) => item),
              ...(entry.icon ? { icon: entry.icon } : {}),
              collapsible: entry.collapsible,
              collapsed: entry.collapsed,
            },
            sort: entry.sort ?? 0,
          })
      } else {
        const item = await renderItem(ctx, entry, currentUrl)
        if (item) result.push({ group: { label: '', items: [item] }, sort: entry.sort ?? 0 })
      }
    }
    result.sort((a, b) => a.sort - b.sort || a.group.label.localeCompare(b.group.label))
    return result.map(({ group }) => group)
  }

  const groups = new Map<string, { item: NavItem; sort: number }[]>()
  for (const resource of panel.resources) {
    if (resource.parent) continue
    if (!(await authorizeResource(ctx, resource, 'viewAny'))) continue
    const group = resource.definition.navigation?.group ?? 'Resources'
    const items = groups.get(group) ?? []
    const badge = resource.definition.navigation?.badge
      ? await resource.definition.navigation.badge(ctx)
      : undefined
    items.push({
      item: {
        label: resource.pluralLabel,
        url: resource.urls.list,
        active: matches(resource.urls.list, currentUrl),
        ...(resource.definition.icon ? { icon: resource.definition.icon } : {}),
        ...(typeof badge === 'string' || typeof badge === 'number' ? { badge } : {}),
      },
      sort: resource.definition.navigation?.sort ?? 0,
    })
    groups.set(group, items)
  }
  for (const page of panel.pages) {
    if (page.definition.canAccess && !(await page.definition.canAccess(ctx))) continue
    const group = page.definition.navigation?.group ?? 'Pages'
    const items = groups.get(group) ?? []
    const badge = page.definition.navigation?.badge
    const renderedBadge = typeof badge === 'function' ? await badge(ctx) : badge
    items.push({
      item: {
        label: page.definition.navigation?.label ?? page.definition.title,
        url: page.url,
        active: matches(page.url, currentUrl),
        ...(page.definition.icon ? { icon: page.definition.icon } : {}),
        ...(typeof renderedBadge === 'string' || typeof renderedBadge === 'number'
          ? { badge: renderedBadge }
          : {}),
      },
      sort: page.definition.navigation?.sort ?? 0,
    })
    groups.set(group, items)
  }
  return [...groups]
    .map(([label, items]) => ({
      label,
      items: items
        .sort((a, b) => a.sort - b.sort || a.item.label.localeCompare(b.item.label))
        .map(({ item }) => item),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
