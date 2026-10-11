import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { HttpContext } from '@adonisjs/core/http'
import type { HttpRouterService } from '@adonisjs/core/types'
import PupitreContextMiddleware from './middleware/pupitre_context.js'
import SharePropsMiddleware from './middleware/share_props.js'
import TenancyResolverMiddleware from './middleware/tenancy_resolver.js'
import ResourceController from './controllers/resource_controller.js'
import ActionController from './controllers/action_controller.js'
import UploadController from './controllers/upload_controller.js'
import { authorizeResource } from '../authz/bouncer.js'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import type { ResourceRuntime } from '../manager.js'
import { registerAuthRoutes } from '../auth/routes.js'
import { registerTenancyRoutes } from '../tenancy/routes.js'
import { registerNotificationRoutes } from '../notifications/routes.js'
import { registerSearchRoutes } from '../search/routes.js'
import { registerCustomPageRoutes } from '../pages/routes.js'
import { registerOptionsRoutes } from '../options/routes.js'
import { panelGuard } from '../auth/guard.js'

function constrainPrimaryKey(
  route: { where(parameter: string, matcher: RegExp): unknown },
  resource: ResourceRuntime
): void {
  const primaryKey = (resource.model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
  if (primaryKey === 'id' && !resource.model.selfAssignPrimaryKey) route.where('id', /^\d+$/)
}

/**
 * Route groups of one panel. Every group is named `<panel>.` and honours
 * `.domain()`. Feature modules register their routes into the right group:
 *
 * - `guest`: panel path, no host middleware, no authentication required
 *   (login, password reset, registration, email verification links).
 * - `user`: panel path, host middleware + authenticated user, no tenant
 *   segment (logout, profile, tenant chooser).
 * - `tenant`: panel path + `/:tenant` in tenancy mode `url`, host middleware,
 *   authenticated user, tenancy resolved (resources, custom pages, `/_pupitre/*`).
 *   Without tenancy it has the same prefix as `user`.
 */
export type PanelRouteGroups = {
  guest(register: () => void): void
  user(register: () => void): void
  tenant(register: () => void): void
}

function createGroups(router: HttpRouterService, panel: PanelRuntime): PanelRouteGroups {
  const context = (requireUser: boolean) => (ctx: HttpContext, next: () => Promise<void>) =>
    new PupitreContextMiddleware({ requireUser }).handle(ctx, next)
  const tenancy = (ctx: HttpContext, next: () => Promise<void>) =>
    new TenancyResolverMiddleware().handle(ctx, next)
  const share = (ctx: HttpContext, next: () => Promise<void>) =>
    new SharePropsMiddleware().handle(ctx, next)
  const tenantPrefix =
    panel.tenancy?.mode === 'url' ? `${panel.path.replace(/\/$/, '')}/:tenant` : panel.path
  const group = (
    register: () => void,
    prefix: string,
    middleware: Parameters<ReturnType<HttpRouterService['group']>['use']>[0]
  ) => {
    const routes = router.group(register).prefix(prefix).use(middleware).as(panel.id)
    if (panel.domain) routes.domain(panel.domain)
  }
  return {
    guest: (register) => group(register, panel.path, [context(false), share]),
    user: (register) =>
      group(register, panel.path, [
        ...panel.middleware,
        context(Boolean(panelGuard(panel))),
        share,
      ]),
    tenant: (register) =>
      group(register, tenantPrefix, [
        ...panel.middleware,
        context(Boolean(panelGuard(panel))),
        tenancy,
        share,
      ]),
  }
}

export function registerPanelRoutes(
  router: HttpRouterService,
  panel: PanelRuntime,
  manager: PupitreManager
): void {
  const groups = createGroups(router, panel)
  registerAuthRoutes(router, panel, groups, manager)
  registerTenancyRoutes(router, panel, groups, manager)
  groups.tenant(() => {
    router
      .get('/', async (ctx) => {
        for (const resource of ctx.pupitre.panel.resources) {
          if (
            resource.definition.pages.list &&
            (await authorizeResource(ctx, resource, 'viewAny'))
          ) {
            return ctx.response.redirect(resource.urls.list)
          }
        }
        return ctx.response.notFound()
      })
      .as('dashboard')

    registerCustomPageRoutes(router, panel, manager)

    for (const resource of panel.resources) {
      const slug = resource.slug
      const resolveSlug = (ctx: HttpContext, next: () => Promise<void>) => {
        ctx.params.slug = slug
        return next()
      }
      if (resource.definition.pages.list)
        router.get(`/${slug}`, [ResourceController, 'list']).as(`${slug}.list`).use(resolveSlug)
      if (resource.definition.pages.create) {
        router
          .get(`/${slug}/create`, [ResourceController, 'create'])
          .as(`${slug}.create`)
          .use(resolveSlug)
        router.post(`/${slug}`, [ResourceController, 'store']).as(`${slug}.store`).use(resolveSlug)
      }
      router
        .get(`/${slug}/actions/:action`, [ActionController, 'show'])
        .as(`${slug}.actions`)
        .use(resolveSlug)
      router
        .post(`/${slug}/actions/:action`, [ActionController, 'run'])
        .as(`${slug}.actions.store`)
        .use(resolveSlug)
      const recordActionGet = router.get(`/${slug}/:id/actions/:action`, [ActionController, 'show'])
      constrainPrimaryKey(recordActionGet, resource)
      recordActionGet.as(`${slug}.record.actions`).use(resolveSlug)
      const recordActionPost = router.post(`/${slug}/:id/actions/:action`, [
        ActionController,
        'run',
      ])
      constrainPrimaryKey(recordActionPost, resource)
      recordActionPost.as(`${slug}.record.actions.store`).use(resolveSlug)
      if (resource.definition.pages.edit) {
        const editRoute = router.get(`/${slug}/:id/edit`, [ResourceController, 'edit'])
        constrainPrimaryKey(editRoute, resource)
        editRoute.as(`${slug}.edit`).use(resolveSlug)
        const updateRoute = router.put(`/${slug}/:id`, [ResourceController, 'update'])
        constrainPrimaryKey(updateRoute, resource)
        updateRoute.as(`${slug}.update`).use(resolveSlug)
      }
      if (resource.definition.pages.view) {
        const viewRoute = router.get(`/${slug}/:id`, [ResourceController, 'view'])
        constrainPrimaryKey(viewRoute, resource)
        viewRoute.as(`${slug}.view`).use(resolveSlug)
      }
      const destroyRoute = router.delete(`/${slug}/:id`, [ResourceController, 'destroy'])
      constrainPrimaryKey(destroyRoute, resource)
      destroyRoute.as(`${slug}.destroy`).use(resolveSlug)
    }
    router.post('/_pupitre/upload', [UploadController, 'store']).as('upload.store')
    router.delete('/_pupitre/upload', [UploadController, 'destroy']).as('upload.destroy')
    registerOptionsRoutes(router, panel, manager)
    registerSearchRoutes(router, panel, manager)
    registerNotificationRoutes(router, panel, manager)
  })
}
