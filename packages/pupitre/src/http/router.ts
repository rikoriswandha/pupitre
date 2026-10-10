import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { HttpContext } from '@adonisjs/core/http'
import type { HttpRouterService } from '@adonisjs/core/types'
import PupitreContextMiddleware from './middleware/pupitre_context.js'
import SharePropsMiddleware from './middleware/share_props.js'
import ResourceController from './controllers/resource_controller.js'
import ActionController from './controllers/action_controller.js'
import UploadController from './controllers/upload_controller.js'
import { authorizeResource } from '../authz/bouncer.js'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import type { ResourceRuntime } from '../manager.js'

function constrainPrimaryKey(
  route: { where(parameter: string, matcher: RegExp): unknown },
  resource: ResourceRuntime
): void {
  const primaryKey = (resource.model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
  if (primaryKey === 'id' && !resource.model.selfAssignPrimaryKey) route.where('id', /^\d+$/)
}
export function registerPanelRoutes(
  router: HttpRouterService,
  panel: PanelRuntime,
  _manager: PupitreManager
): void {
  router
    .group(() => {
      router
        .get('/', async (ctx) => {
          for (const resource of panel.resources) {
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
          router
            .post(`/${slug}`, [ResourceController, 'store'])
            .as(`${slug}.store`)
            .use(resolveSlug)
        }
        router
          .get(`/${slug}/actions/:action`, [ActionController, 'show'])
          .as(`${slug}.actions`)
          .use(resolveSlug)
        router
          .post(`/${slug}/actions/:action`, [ActionController, 'run'])
          .as(`${slug}.actions.store`)
          .use(resolveSlug)
        const recordActionGet = router.get(`/${slug}/:id/actions/:action`, [
          ActionController,
          'show',
        ])
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
    })
    .prefix(panel.path)
    .use([
      ...panel.middleware,
      (ctx, next) => new PupitreContextMiddleware().handle(ctx, next),
      (ctx, next) => new SharePropsMiddleware().handle(ctx, next),
    ])
    .as(panel.id)
}
