import type { HttpRouterService } from '@adonisjs/core/types'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import CustomPageController from './controller.js'

/** Registers custom page routes (WP23) inside the tenant group before resources. */
export function registerCustomPageRoutes(
  router: HttpRouterService,
  panel: PanelRuntime,
  _manager: PupitreManager
): void {
  for (const page of panel.pages) {
    const resolvePage = (ctx: { params: Record<string, string> }, next: () => Promise<void>) => {
      ctx.params.slug = page.slug
      return next()
    }
    router.get(page.definition.path, [CustomPageController, 'show']).as(page.slug).use(resolvePage)
    if (page.definition.form && page.definition.save) {
      router
        .post(page.definition.path, [CustomPageController, 'store'])
        .as(`${page.slug}.store`)
        .use(resolvePage)
    }
    router
      .get(`${page.definition.path.replace(/\/$/, '')}/actions/:action`, [
        CustomPageController,
        'showAction',
      ])
      .as(`${page.slug}.actions`)
      .use(resolvePage)
    router
      .post(`${page.definition.path.replace(/\/$/, '')}/actions/:action`, [
        CustomPageController,
        'runAction',
      ])
      .as(`${page.slug}.actions.store`)
      .use(resolvePage)
  }
}
