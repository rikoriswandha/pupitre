import type { HttpContext } from '@adonisjs/core/http'
import type { UserMenuItem } from '../../catalog/wire.js'

export async function buildUserMenu(ctx: HttpContext): Promise<UserMenuItem[]> {
  const result: { item: UserMenuItem; sort: number }[] = []
  for (const definition of ctx.pupitre.panel.userMenu) {
    if (definition.visible === false) continue
    if (typeof definition.visible === 'function' && !(await definition.visible(ctx))) continue
    result.push({
      item: {
        label: definition.label,
        url: definition.url,
        ...(definition.icon ? { icon: definition.icon } : {}),
        ...(definition.method ? { method: definition.method } : {}),
        ...(definition.external ? { external: true } : {}),
      },
      sort: definition.sort ?? 0,
    })
  }
  return result
    .sort(
      (left, right) => left.sort - right.sort || left.item.label.localeCompare(right.item.label)
    )
    .map(({ item }) => item)
}
