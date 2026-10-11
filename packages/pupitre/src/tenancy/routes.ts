import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import type { HttpRouterService } from '@adonisjs/core/types'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import type { PanelRouteGroups } from '../http/router.js'
import { resolveTenancyAdapter } from './runtime.js'

/** Registers tenant home and implicit tenant-switch routes. */
export function registerTenancyRoutes(
  _router: HttpRouterService,
  panel: PanelRuntime,
  groups: PanelRouteGroups,
  _manager: PupitreManager
): void {
  const tenancy = panel.tenancy
  if (!tenancy) return

  if (tenancy.mode === 'url') {
    groups.user(() => {
      _router
        .get('/', async (ctx) => {
          const adapter = await resolveTenancyAdapter(ctx)
          const tenants = adapter ? await adapter.listForUser(ctx) : []
          const first = tenants[0]
          if (!first) throw new E_PUPITRE_FORBIDDEN()
          const segment = first.slug ?? encodeURIComponent(String(first.id))
          return ctx.response.redirect(`${panel.path}/${segment}`)
        })
        .as('tenant.home')
    })
    return
  }

  groups.user(() => {
    _router
      .post('/_pupitre/tenant', async (ctx) => {
        const adapter = await resolveTenancyAdapter(ctx)
        const tenantId = ctx.request.input('tenant')
        if ((typeof tenantId !== 'string' && typeof tenantId !== 'number') || !adapter?.switch)
          throw new E_PUPITRE_FORBIDDEN()
        if (!(await adapter.switch(ctx, tenantId))) throw new E_PUPITRE_FORBIDDEN()
        return ctx.response.redirect(panel.path)
      })
      .as('tenant.switch')
  })
}
