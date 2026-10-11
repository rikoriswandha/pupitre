import type { HttpRouterService } from '@adonisjs/core/types'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import OptionsController from './controller.js'

/** Registers the options search and create-option modal routes. */
export function registerOptionsRoutes(
  router: HttpRouterService,
  _panel: PanelRuntime,
  _manager: PupitreManager
): void {
  const controller = new OptionsController()
  router
    .get('/_pupitre/options/:resource/:field', (ctx) =>
      ctx.request.qs().create === '1' ? controller.createForm(ctx) : controller.index(ctx)
    )
    .as('options')
  router
    .post('/_pupitre/options/:resource/:field', (ctx) => controller.store(ctx))
    .as('options.store')
}
