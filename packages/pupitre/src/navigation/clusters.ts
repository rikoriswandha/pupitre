import type { HttpContext } from '@adonisjs/core/http'
import type { PanelRuntime } from '../manager.js'
import type { ClusterDefinition } from '../definition/cluster.js'
import type { SubNavigationItem } from '../../catalog/wire.js'
import { authorizeResource } from '../authz/bouncer.js'
import { resourceUrls, pageUrl } from '../manager.js'
import { requestMessages, resolveTranslations } from '../i18n.js'
import { E_PUPITRE_INVALID_CLUSTER } from '../errors.js'

export const requestClusters = new WeakMap<
  HttpContext,
  Map<string, { definition: ClusterDefinition; items: SubNavigationItem[] }>
>()

/** Discover referenced clusters and normalize routes once, before registering the panel. */
export function prepareClusters(panel: PanelRuntime): void {
  const clusters = new Map<string, ClusterDefinition>()
  for (const owner of [...panel.resources, ...panel.pages]) {
    const cluster = owner.definition.cluster
    if (!cluster) continue
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(cluster.slug))
      throw new E_PUPITRE_INVALID_CLUSTER([`Invalid Pupitre cluster slug "${cluster.slug}"`])
    if (
      [
        'locale',
        'dashboard',
        'search',
        'notifications',
        'options',
        'upload',
        'profile',
        'login',
        'logout',
        'register',
        'password',
        'email',
        'tenant',
      ].includes(cluster.slug)
    )
      throw new E_PUPITRE_INVALID_CLUSTER([`Reserved Pupitre cluster slug "${cluster.slug}"`])
    if ([...panel.resources, ...panel.pages].some((child) => child.slug === cluster.slug))
      throw new E_PUPITRE_INVALID_CLUSTER([
        `Pupitre cluster slug collision "${cluster.slug}" in panel "${panel.id}"`,
      ])
    const existing = clusters.get(cluster.slug)
    if (existing && JSON.stringify(existing) !== JSON.stringify(cluster))
      throw new E_PUPITRE_INVALID_CLUSTER([
        `Conflicting Pupitre cluster definitions "${cluster.slug}"`,
      ])
    clusters.set(cluster.slug, cluster)
  }
  for (const resource of panel.resources) {
    const parent =
      resource.parent &&
      panel.resources.find((candidate) => candidate.slug === resource.parent!.resource)
    const cluster = parent ? parent.definition.cluster : resource.definition.cluster
    if (parent && resource.definition.cluster && resource.definition.cluster.slug !== cluster?.slug)
      throw new E_PUPITRE_INVALID_CLUSTER([
        `Nested resource "${resource.slug}" must belong to its parent's cluster`,
      ])
    if (!cluster) continue
    resource.definition = { ...resource.definition, cluster }
    resource.routeSlug = `${cluster.slug}/${resource.routeSlug}`
    resource.urls = resourceUrls(panel.path, resource.routeSlug)
  }
  for (const page of panel.pages) {
    if (!page.definition.cluster) continue
    page.definition = {
      ...page.definition,
      path: `/${page.definition.cluster.slug}${page.definition.path}`,
    }
    page.url = pageUrl(panel.path, page.definition.path)
  }
}

/** Request-local sibling navigation uses precisely the same gates as main navigation. */
export async function accessibleClusters(ctx: HttpContext) {
  const cached = requestClusters.get(ctx)
  if (cached) return cached
  const result = new Map<string, { definition: ClusterDefinition; items: SubNavigationItem[] }>()
  const children: { item: SubNavigationItem; cluster: ClusterDefinition; sort: number }[] = []
  const current = ctx.request.url().split('?')[0]!
  for (const resource of ctx.pupitre.panel.resources) {
    const cluster = resource.definition.cluster
    if (
      !cluster ||
      resource.parent ||
      !resource.definition.pages.list ||
      !(await authorizeResource(ctx, resource, 'viewAny'))
    )
      continue
    children.push({
      cluster,
      sort: resource.definition.navigation?.sort ?? 0,
      item: {
        key: resource.slug,
        label: resource.pluralLabel,
        url: resource.urls.list,
        active: current === resource.urls.list || current.startsWith(`${resource.urls.list}/`),
      },
    })
  }
  for (const page of ctx.pupitre.panel.pages) {
    const cluster = page.definition.cluster
    if (!cluster || (page.definition.canAccess && !(await page.definition.canAccess(ctx)))) continue
    children.push({
      cluster,
      sort: page.definition.navigation?.sort ?? 0,
      item: {
        key: page.slug,
        label: page.definition.navigation?.label ?? page.definition.title,
        url: page.url,
        active: current === page.url || current.startsWith(`${page.url}/`),
      },
    })
  }
  children.sort(
    (a, b) =>
      a.sort - b.sort ||
      resolveTranslations(
        a.item.label,
        ctx.pupitre.locale,
        requestMessages.get(ctx) ?? {}
      ).localeCompare(
        resolveTranslations(b.item.label, ctx.pupitre.locale, requestMessages.get(ctx) ?? {}),
        ctx.pupitre.locale
      )
  )
  for (const child of children) {
    const group = result.get(child.cluster.slug) ?? { definition: child.cluster, items: [] }
    group.items.push(child.item)
    result.set(child.cluster.slug, group)
  }
  requestClusters.set(ctx, result)
  return result
}
