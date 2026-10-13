import TableViewsController from '../table/views/controller.js'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { HttpContext } from '@adonisjs/core/http'
import type { HttpRouterService } from '@adonisjs/core/types'
import PupitreContextMiddleware from './middleware/pupitre_context.js'
import SharePropsMiddleware from './middleware/share_props.js'
import TenancyResolverMiddleware from './middleware/tenancy_resolver.js'
import BrowserSessionMiddleware from './middleware/browser_session.js'
import ResourceController from './controllers/resource_controller.js'
import ActionController from './controllers/action_controller.js'
import EvaluateController from './controllers/evaluate_controller.js'
import ExportController from './controllers/export_controller.js'
import ExportsController from './controllers/exports_controller.js'
import ImportController from './controllers/import_controller.js'
import UploadController from './controllers/upload_controller.js'
import { authorizeResource } from '../authz/bouncer.js'
import { isReadOnlyResource } from '../definition/resource.js'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import type { ResourceRuntime } from '../manager.js'
import { registerAuthRoutes } from '../auth/routes.js'
import { registerTenancyRoutes } from '../tenancy/routes.js'
import { registerNotificationRoutes } from '../notifications/routes.js'
import { registerSearchRoutes } from '../search/routes.js'
import { registerCustomPageRoutes } from '../pages/routes.js'
import WidgetController from '../widgets/controller.js'
import { registerOptionsRoutes } from '../options/routes.js'
import { panelGuard } from '../auth/guard.js'
import RelationController from './controllers/relation_controller.js'
import { flattenRelationManagers } from '../definition/relation_manager.js'
import LocaleController from '../i18n/locale_controller.js'

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
        (ctx, next) => new BrowserSessionMiddleware().handle(ctx, next),
        share,
      ]),
    tenant: (register) =>
      group(register, tenantPrefix, [
        ...panel.middleware,
        context(Boolean(panelGuard(panel))),
        (ctx, next) => new BrowserSessionMiddleware().handle(ctx, next),
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
    if ((panel.locales?.length ?? 0) > 1)
      router.post('/locale', [LocaleController, 'update']).as('locale')
    router
      .get('/', async (ctx) => {
        if (ctx.pupitre.panel.widgets.length > 0) return new WidgetController().dashboard(ctx)
        for (const resource of ctx.pupitre.panel.resources) {
          if (
            !resource.parent &&
            resource.definition.pages.list &&
            (await authorizeResource(ctx, resource, 'viewAny'))
          ) {
            return ctx.response.redirect(resource.urls.list)
          }
        }
        return ctx.response.notFound()
      })
      .as('dashboard')
    router.get('/_pupitre/widgets/:name', [WidgetController, 'data']).as('widgets.data')
    router
      .get('/_pupitre/widgets/:name/actions/:action', [WidgetController, 'action'])
      .as('widgets.action.form')
    router
      .post('/_pupitre/widgets/:name/actions/:action', [WidgetController, 'action'])
      .as('widgets.action.run')

    registerCustomPageRoutes(router, panel, manager)

    for (const resource of panel.resources) {
      const slug = resource.slug
      const routeBase = `/${resource.routeSlug}`
      const routeName = resource.parent ? `${resource.parent.resource}.${slug}` : slug
      const modalResource = resource.definition.pages.list?.modals === true
      const readOnly = isReadOnlyResource(resource.definition)
      const resolveSlug = (ctx: HttpContext, next: () => Promise<void>) => {
        ctx.params.slug = slug
        return next()
      }
      if (resource.definition.table?.savedViews) {
        router
          .get(`${routeBase}/views`, [TableViewsController, 'index'])
          .as(`${routeName}.views.index`)
          .use(resolveSlug)
        router
          .post(`${routeBase}/views`, [TableViewsController, 'store'])
          .as(`${routeName}.views.store`)
          .use(resolveSlug)
        router
          .put(`${routeBase}/views/:view`, [TableViewsController, 'update'])
          .as(`${routeName}.views.update`)
          .use(resolveSlug)
        router
          .delete(`${routeBase}/views/:view`, [TableViewsController, 'destroy'])
          .as(`${routeName}.views.destroy`)
          .use(resolveSlug)
      }
      if (resource.definition.pages.list)
        router.get(routeBase, [ResourceController, 'list']).as(`${routeName}.list`).use(resolveSlug)
      if (resource.definition.pages.create && !modalResource) {
        router
          .get(`${routeBase}/create`, [ResourceController, 'create'])
          .as(`${routeName}.create`)
          .use(resolveSlug)
        router
          .post(routeBase, [ResourceController, 'store'])
          .as(`${routeName}.store`)
          .use(resolveSlug)
      }
      if (!readOnly) {
        router
          .post(`${routeBase}/export`, [ExportController, 'run'])
          .as(`${routeName}.export`)
          .use(resolveSlug)
        router
          .post(`${routeBase}/import/preview`, [ImportController, 'preview'])
          .as(`${routeName}.import.preview`)
          .use(resolveSlug)
        router
          .post(`${routeBase}/import`, [ImportController, 'store'])
          .as(`${routeName}.import.store`)
          .use(resolveSlug)
        router
          .get(`${routeBase}/actions/:action`, [ActionController, 'show'])
          .as(`${routeName}.actions`)
          .use(resolveSlug)
        router
          .post(`${routeBase}/actions/:action`, [ActionController, 'run'])
          .as(`${routeName}.actions.store`)
          .use(resolveSlug)
      }
      for (const relation of flattenRelationManagers(resource.definition.relations)) {
        const base = `${routeBase}/:id/relations/${relation.relation}`
        const resolveRelation = (ctx: HttpContext, next: () => Promise<void>) => {
          ctx.params.slug = slug
          ctx.params.relation = relation.relation
          return next()
        }
        if (relation.table?.savedViews) {
          constrainPrimaryKey(
            router
              .get(`${base}/views`, [TableViewsController, 'index'])
              .as(`${routeName}.relations.${relation.relation}.views.index`)
              .use(resolveRelation),
            resource
          )
          constrainPrimaryKey(
            router
              .post(`${base}/views`, [TableViewsController, 'store'])
              .as(`${routeName}.relations.${relation.relation}.views.store`)
              .use(resolveRelation),
            resource
          )
          constrainPrimaryKey(
            router
              .put(`${base}/views/:view`, [TableViewsController, 'update'])
              .as(`${routeName}.relations.${relation.relation}.views.update`)
              .use(resolveRelation),
            resource
          )
          constrainPrimaryKey(
            router
              .delete(`${base}/views/:view`, [TableViewsController, 'destroy'])
              .as(`${routeName}.relations.${relation.relation}.views.destroy`)
              .use(resolveRelation),
            resource
          )
        }
        const relationList = router.get(base, [RelationController, 'list'])
        constrainPrimaryKey(relationList, resource)
        relationList.as(`${routeName}.relations.${relation.relation}.list`).use(resolveRelation)

        const actions = [
          ...relation.actions.header,
          ...relation.actions.row,
          ...relation.actions.bulk,
        ]
        const routes = new Map<string, 'header' | 'record' | 'bulk'>()
        for (const action of actions) routes.set(action.name, action.context)
        for (const [name, context] of [
          ['create', 'header'],
          ['attach', 'header'],
          ['associate', 'header'],
          ['edit', 'record'],
          ['view', 'record'],
          ['delete', 'record'],
          ['detach', 'record'],
          ['dissociate', 'record'],
          ['bulk-detach', 'bulk'],
          ['bulk-dissociate', 'bulk'],
        ] as const) {
          if (!routes.has(name)) routes.set(name, context)
        }
        for (const [name, context] of routes) {
          const actionPath =
            context === 'record' ? `${base}/:rid/actions/${name}` : `${base}/actions/${name}`
          const resolveAction = (ctx: HttpContext, next: () => Promise<void>) => {
            ctx.params.slug = slug
            ctx.params.relation = relation.relation
            ctx.params.action = name
            return next()
          }
          const actionGet = router.get(actionPath, [RelationController, 'showAction'])
          constrainPrimaryKey(actionGet, resource)
          actionGet
            .as(`${routeName}.relations.${relation.relation}.actions.${name}`)
            .use(resolveAction)
          if (context === 'header' && (name === 'attach' || name === 'associate')) {
            const optionsRoute = router.get(`${actionPath}/options`, [
              RelationController,
              'options',
            ])
            constrainPrimaryKey(optionsRoute, resource)
            optionsRoute
              .as(`${routeName}.relations.${relation.relation}.actions.${name}.options`)
              .use(resolveAction)
          }
          const actionPost = router.post(actionPath, [RelationController, 'runAction'])
          constrainPrimaryKey(actionPost, resource)
          actionPost
            .as(`${routeName}.relations.${relation.relation}.actions.${name}.store`)
            .use(resolveAction)
          const actionDelete = router.delete(actionPath, [RelationController, 'runAction'])
          constrainPrimaryKey(actionDelete, resource)
          actionDelete
            .as(`${routeName}.relations.${relation.relation}.actions.${name}.destroy`)
            .use(resolveAction)
        }
      }
      if (!readOnly) {
        const recordActionGet = router.get(`${routeBase}/:id/actions/:action`, [
          ActionController,
          'show',
        ])
        constrainPrimaryKey(recordActionGet, resource)
        recordActionGet.as(`${routeName}.record.actions`).use(resolveSlug)
        const recordActionPost = router.post(`${routeBase}/:id/actions/:action`, [
          ActionController,
          'run',
        ])
        constrainPrimaryKey(recordActionPost, resource)
        recordActionPost.as(`${routeName}.record.actions.store`).use(resolveSlug)
        const columnRoute = router.patch(`${routeBase}/:id/column/:name`, [
          ResourceController,
          'updateColumn',
        ])
        constrainPrimaryKey(columnRoute, resource)
        columnRoute.as(`${routeName}.column.update`).use(resolveSlug)
        router
          .post(`${routeBase}/reorder`, [ResourceController, 'reorder'])
          .as(`${routeName}.reorder`)
          .use(resolveSlug)
      }
      if (resource.definition.pages.edit && !modalResource) {
        const editRoute = router.get(`${routeBase}/:id/edit`, [ResourceController, 'edit'])
        constrainPrimaryKey(editRoute, resource)
        editRoute.as(`${routeName}.edit`).use(resolveSlug)
        const updateRoute = router.put(`${routeBase}/:id`, [ResourceController, 'update'])
        constrainPrimaryKey(updateRoute, resource)
        updateRoute.as(`${routeName}.update`).use(resolveSlug)
      }
      if (resource.definition.pages.view) {
        const viewRoute = router.get(`${routeBase}/:id`, [ResourceController, 'view'])
        constrainPrimaryKey(viewRoute, resource)
        viewRoute.as(`${routeName}.view`).use(resolveSlug)
      }
      if (!readOnly) {
        const destroyRoute = router.delete(`${routeBase}/:id`, [ResourceController, 'destroy'])
        constrainPrimaryKey(destroyRoute, resource)
        destroyRoute.as(`${routeName}.destroy`).use(resolveSlug)
      }
    }
    router.post('/_pupitre/upload', [UploadController, 'store']).as('upload.store')
    router.delete('/_pupitre/upload', [UploadController, 'destroy']).as('upload.destroy')
    router.post('/_pupitre/evaluate', [EvaluateController, 'evaluate']).as('evaluate')
    router.get('/_pupitre/exports/:id', [ExportsController, 'progress']).as('exports.progress')
    router
      .get('/_pupitre/exports/:id/download', [ExportsController, 'download'])
      .as('exports.download')
    registerOptionsRoutes(router, panel, manager)
    registerSearchRoutes(router, panel, manager)
    registerNotificationRoutes(router, panel, manager)
  })
}
/** Register plugin protocols inside the same authenticated, tenant-resolved panel groups. */
export { createGroups as panelRouteGroups }
