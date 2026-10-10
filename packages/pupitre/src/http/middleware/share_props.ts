import type { HttpContext } from '@adonisjs/core/http'
import { authorizeResource } from '../../authz/bouncer.js'
import type { NavItem } from '../../../catalog/wire.js'

export default class SharePropsMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const allowed = []
    for (const resource of ctx.pupitre.panel.resources) {
      if (await authorizeResource(ctx, resource, 'viewAny')) allowed.push(resource)
    }
    const groups = new Map<string, typeof allowed>()
    for (const resource of allowed) {
      const group = resource.definition.navigation?.group ?? 'Resources'
      const items = groups.get(group) ?? []
      items.push(resource)
      groups.set(group, items)
    }
    const currentUrl = ctx.request.url().split('?')[0]
    const nav = []
    for (const [label, resources] of groups) {
      const items: NavItem[] = []
      resources.sort(
        (left, right) =>
          (left.definition.navigation?.sort ?? 0) - (right.definition.navigation?.sort ?? 0) ||
          left.label.localeCompare(right.label)
      )
      for (const resource of resources) {
        const badge = resource.definition.navigation?.badge
          ? await resource.definition.navigation.badge(ctx)
          : undefined
        items.push({
          label: resource.pluralLabel,
          url: resource.urls.list,
          active:
            currentUrl === resource.urls.list || currentUrl.startsWith(`${resource.urls.list}/`),
          ...(resource.definition.icon ? { icon: resource.definition.icon } : {}),
          ...(typeof badge === 'string' || typeof badge === 'number' ? { badge } : {}),
        })
      }
      nav.push({ label, items })
    }
    const session = (
      ctx as HttpContext & { session?: { flashMessages?: { get(key: string): unknown } } }
    ).session
    const flashValue = session?.flashMessages?.get('pupitre')
    const flash = Array.isArray(flashValue) ? flashValue : flashValue ? [flashValue] : []
    ctx.inertia.share({
      pupitre: {
        panel: {
          id: ctx.pupitre.panel.id,
          path: ctx.pupitre.panel.path,
          brand: ctx.pupitre.panel.brand ?? { name: ctx.pupitre.panel.id },
          theme: ctx.pupitre.panel.theme ?? {},
          features: {},
        },
        user: ctx.pupitre.user,
        tenant: null,
        nav,
        flash,
        locale: ctx.pupitre.locale,
        timezone: ctx.pupitre.timezone,
      },
    })
    await next()
  }
}
