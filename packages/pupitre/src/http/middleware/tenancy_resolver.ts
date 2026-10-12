import type { HttpContext } from '@adonisjs/core/http'
import { E_PUPITRE_FORBIDDEN } from '../../errors.js'
import type PupitreManager from '../../manager.js'
import { bindPanel } from '../../manager.js'
import { resolveTenancyAdapter } from '../../tenancy/runtime.js'
import { requestMessages, resolveTranslations, t } from '../../i18n.js'

export default class TenancyResolverMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const panel = ctx.pupitre.panel
    const tenancy = panel.tenancy
    if (!tenancy) return next()

    const adapter = await resolveTenancyAdapter(ctx)
    if (!adapter) return next()
    let tenant = await adapter.resolve(ctx)

    if (!tenant && tenancy.mode === 'implicit') {
      const tenants = await adapter.listForUser(ctx)
      if (tenants.length === 0) throw new E_PUPITRE_FORBIDDEN()
      if (!adapter.switch || !(await adapter.switch(ctx, tenants[0]!.id)))
        throw new E_PUPITRE_FORBIDDEN()
      tenant = await adapter.resolve(ctx)
    }
    if (!tenant)
      return ctx.response.notFound(
        resolveTranslations(
          t('Tenant not found'),
          ctx.pupitre.locale,
          requestMessages.get(ctx) ?? {}
        )
      )

    ctx.pupitre.tenant = tenant
    if (tenancy.mode === 'url') {
      const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
      ctx.pupitre.panel = bindPanel(manager.getPanel(panel.id)!, `${panel.path}/${tenant.slug}`)
    }

    if (adapter.run) return adapter.run(tenant, next)
    return next()
  }
}
