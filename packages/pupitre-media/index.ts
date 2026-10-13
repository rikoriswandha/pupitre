import { HttpContext } from '@adonisjs/core/http'
import type { ResourceBuilder } from '@rikology/pupitre'
import vine from '@vinejs/vine'
import {
  action,
  actions,
  definePlugin,
  defineResource,
  pages,
  panelRouteGroups,
  schema,
  table,
  t,
  E_PUPITRE_FORBIDDEN,
} from '@rikology/pupitre'
import { mediaCatalog } from './catalog.js'
import { PupitreMedia } from './src/model.js'
import {
  adoptMedia,
  authorizeMedia,
  deleteMediaFiles,
  mediaPresentation,
  mediaQuery,
  registerMedia,
  resolveMedia,
} from './src/service.js'
import type { MediaOptions } from './src/service.js'
import { mediaColumn, mediaEntry } from './src/fields.js'
export { PupitreMedia, mediaCatalog, mediaColumn, mediaEntry }
export { mediaPicker } from './src/fields.js'
export { configure } from './configure.js'
export { authorizeMedia, resolveMedia, mediaPresentation } from './src/service.js'
export type { MediaOptions, MediaAbility } from './src/service.js'
export type { MediaConversion } from './src/drivers/sharp.js'

export function media(options: MediaOptions = {}) {
  if (
    options.maxFileSize !== undefined &&
    (!Number.isSafeInteger(options.maxFileSize) || options.maxFileSize <= 0)
  )
    throw new Error('Invalid media maxFileSize')
  if (options.conversions)
    for (const [name, conversion] of Object.entries(options.conversions)) {
      if (
        !/^[a-z][a-z0-9_-]*$/.test(name) ||
        !Number.isSafeInteger(conversion.width) ||
        conversion.width <= 0 ||
        (conversion.height !== undefined &&
          (!Number.isSafeInteger(conversion.height) || conversion.height <= 0))
      )
        throw new Error('Invalid media conversion')
    }
  class MediaResourcePolicy {
    static containerInjections = {
      _constructor: {
        dependencies: [HttpContext],
        createError: (message: string) => new Error(message),
      },
    }
    constructor(private ctx: HttpContext) {}
    viewAny() {
      return authorizeMedia(this.ctx, 'viewAny', undefined, options)
    }
    view(_user: unknown, record: PupitreMedia) {
      return authorizeMedia(this.ctx, 'view', record, options)
    }
    create() {
      return authorizeMedia(this.ctx, 'create', undefined, options)
    }
    update(_user: unknown, record: PupitreMedia) {
      return authorizeMedia(this.ctx, 'update', record, options)
    }
    delete(_user: unknown, record: PupitreMedia) {
      return authorizeMedia(this.ctx, 'delete', record, options)
    }
  }
  // Context injection matches Adonis policy construction rather than mutable global request state.
  const resource: ResourceBuilder<typeof PupitreMedia> = defineResource(PupitreMedia)
    .slug('media')
    .label(t('Media'))
    .pluralLabel(t('Media'))
    .icon('image')
    .policy(MediaResourcePolicy)
    .recordTitle('filename')
    .navigation({ group: options.navigationGroup ?? t('Content') })
    .scope(
      options.tenancy
        ? (query, ctx) => {
            if (!ctx.pupitre.tenant) query.whereRaw('1 = 0')
            else query.where('tenant_id', String(ctx.pupitre.tenant.id))
          }
        : false
    )
    .form((s) => [
      s
        .fileUpload('path')
        .disk(options.disk ?? 'uploads')
        .directory(options.directory ?? 'media')
        .visibility(options.visibility ?? 'private')
        .maxSize(options.maxFileSize ?? 10 * 1024 * 1024)
        .accept(options.acceptedFileTypes ?? ['image/*'])
        .hidden(() => true)
        .dehydrated(false),
      s.text('filename').required(),
      s.text('alt'),
      s.text('title'),
      s.textarea('caption'),
    ])
    .table((builder) =>
      builder
        .columns([
          mediaColumn('id').label(t('Media')),
          table.text('filename').searchable(),
          table.text('alt').searchable(),
          table.text('mime'),
        ])
        .filters([
          table.filter.select('mime').options({
            'image/png': 'PNG',
            'image/jpeg': 'JPEG',
            'image/webp': 'WebP',
            'application/pdf': 'PDF',
          }),
          table.filter.dateRange('createdAt'),
        ])
        .layout.grid({ default: 2, md: 3, xl: 4 })
    )
    .infolist((s) => [
      mediaEntry('id').label(t('Media')),
      s.textEntry('filename'),
      s.textEntry('alt'),
      s.textEntry('title'),
      s.textEntry('caption'),
    ])
    .actions({
      header: [
        action('upload-media')
          .label(t('Upload media'))
          .form([
            schema
              .fileUpload('path')
              .label(t('Media'))
              .multiple()
              .required()
              .disk(options.disk ?? 'uploads')
              .directory(options.directory ?? 'media')
              .visibility(options.visibility ?? 'private')
              .maxSize(options.maxFileSize ?? 10 * 1024 * 1024)
              .accept(options.acceptedFileTypes ?? ['image/*']),
          ])
          .can('create')
          .handle(async ({ ctx, data }) => {
            if (!ctx) throw new E_PUPITRE_FORBIDDEN()
            const paths = data?.path as string[]
            for (const path of paths) await adoptMedia(ctx, path, resource.definition.form!)
          })
          .after(({ refresh }) => refresh.table()),
      ],
      row: [actions.view(), actions.edit(), actions.delete()],
      bulk: [
        actions
          .bulk('delete-media')
          .label(t('Delete media'))
          .can('delete')
          .requiresConfirmation()
          .handle(async ({ records }) => {
            for (const record of records ?? []) {
              if (!(record instanceof PupitreMedia)) throw new E_PUPITRE_FORBIDDEN()
              await deleteMediaFiles(record)
              await record.delete()
            }
          }),
      ],
    })
    .beforeDelete((record) => deleteMediaFiles(record))
    .pages({ list: pages.list(), edit: pages.edit(), view: pages.view() })
  return definePlugin({
    name: 'media',
    catalog: [mediaCatalog],
    resources: [resource],
    middleware: [
      (ctx, next) => {
        ctx.containerResolver.bindValue(HttpContext, ctx)
        return next()
      },
    ],
    async boot({ panel, app }) {
      const router = await app.container.make('router')
      registerMedia(panel, options)
      panelRouteGroups(router, panel).tenant(() => {
        router
          .get('/_pupitre/media', async (ctx) => {
            if (!(await authorizeMedia(ctx, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
            const input = await vine
              .compile(
                vine.object({
                  q: vine.string().trim().maxLength(200).optional(),
                  ids: vine
                    .array(vine.number().positive().withoutDecimals())
                    .maxLength(100)
                    .optional(),
                  conversion: vine
                    .string()
                    .regex(/^[a-z][a-z0-9_-]*$/)
                    .optional(),
                })
              )
              .validate(ctx.request.qs())
            if (input.ids) {
              const rows = []
              for (const id of input.ids) {
                const record = await resolveMedia(ctx, id)
                if (record) rows.push(await mediaPresentation(record, input.conversion))
              }
              return { rows }
            }
            const query = mediaQuery(ctx)
            if (input.q)
              query.where((search) =>
                search
                  .where('filename', 'like', `%${input.q}%`)
                  .orWhere('alt', 'like', `%${input.q}%`)
              )
            const rows = []
            for (const record of (await query.orderBy('id', 'desc').limit(50)) as PupitreMedia[])
              if (await authorizeMedia(ctx, 'view', record))
                rows.push(await mediaPresentation(record, input.conversion))
            return { rows }
          })
          .as('media.options')
        router
          .post('/_pupitre/media', async (ctx) => {
            if (!(await authorizeMedia(ctx, 'create'))) throw new E_PUPITRE_FORBIDDEN()
            const input = await vine
              .compile(
                vine.object({
                  paths: vine.array(vine.string().maxLength(1024)).minLength(1).maxLength(50),
                  filenames: vine.array(vine.string().maxLength(255)).maxLength(50).optional(),
                })
              )
              .validate(ctx.request.all())
            const rows = []
            for (const [index, path] of input.paths.entries()) {
              const record = await adoptMedia(ctx, path, resource.definition.form!)
              if (input.filenames?.[index]) {
                record.filename = input.filenames[index]
                await record.save()
              }
              rows.push(await mediaPresentation(record))
            }
            return ctx.response.created({ rows })
          })
          .as('media.upload')
      })
    },
  })
}
