import type { HttpRouterService } from '@adonisjs/core/types'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import { searchResources } from './query_service.js'

/** Registers GET /_pupitre/search inside the panel's tenant route group. */
export function registerSearchRoutes(
  router: HttpRouterService,
  _panel: PanelRuntime,
  _manager: PupitreManager
): void {
  router
    .get('/_pupitre/search', async (ctx) => {
      if (!ctx.pupitre.panel.globalSearch) return ctx.response.notFound()
      const { groups } = await searchResources(
        ctx,
        ctx.pupitre.panel.resources,
        ctx.request.input('q')
      )
      return ctx.response.json({ groups })
    })
    .as('search')
}
