import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import { createError } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  PanelRuntime,
  PupitreConfig,
  PupitreStorage,
  SchemaNodeDefinition,
} from '@rikology/pupitre'
import {
  createPupitreStorage,
  consumeFormUploads,
  scopedQuery,
  sniffUploadMime,
  isUploadMimeAllowed,
  E_PUPITRE_FORBIDDEN,
  E_PUPITRE_INVALID_UPLOAD,
} from '@rikology/pupitre'
import { PupitreMedia } from './model.js'
import { convertImage } from './drivers/sharp.js'
import type { MediaConversion } from './drivers/sharp.js'

export type MediaAbility = 'viewAny' | 'view' | 'create' | 'update' | 'delete'
export type MediaOptions = {
  disk?: string
  directory?: string
  visibility?: 'public' | 'private'
  maxFileSize?: number
  acceptedFileTypes?: string[]
  conversions?: Record<string, MediaConversion> | false
  navigationGroup?: string
  tenancy?: boolean
  authorize?: (
    ctx: HttpContext,
    ability: MediaAbility,
    record?: PupitreMedia
  ) => boolean | Promise<boolean>
}
export const E_PUPITRE_MEDIA_TENANT = createError(
  'Media requires an active tenant',
  'E_PUPITRE_MEDIA_TENANT',
  403
)
const configurations = new WeakMap<object, MediaOptions>()
export function registerMedia(panel: PanelRuntime, options: MediaOptions) {
  const definition = panel.resources.find((resource) => resource.slug === 'media')?.definition
  if (!definition) throw new E_PUPITRE_FORBIDDEN()
  configurations.set(definition, options)
}
export function mediaOptions(ctx: HttpContext) {
  const definition = ctx.pupitre.panel.resources.find(
    (resource) => resource.slug === 'media'
  )?.definition
  const options = definition && configurations.get(definition)
  if (!options) throw new E_PUPITRE_FORBIDDEN()
  return options
}
export async function authorizeMedia(
  ctx: HttpContext,
  ability: MediaAbility,
  record?: PupitreMedia,
  options = mediaOptions(ctx)
) {
  if (options.tenancy && !ctx.pupitre.tenant) return false
  if (options.authorize) return Boolean(await options.authorize(ctx, ability, record))
  const config = (await app.container.make('pupitre.config')) as PupitreConfig
  const policies = await config.policies?.()
  const candidate = policies?.MediaPolicy
  const policy =
    candidate && typeof candidate === 'object' && 'default' in candidate
      ? candidate.default
      : candidate
  if (typeof policy !== 'function' || typeof policy.prototype?.[ability] !== 'function')
    return false
  const context = ctx as HttpContext & {
    bouncer?: {
      with(policy: unknown): {
        allows(ability: string, ...records: PupitreMedia[]): Promise<boolean>
      }
    }
  }
  return context.bouncer
    ? context.bouncer.with(policy).allows(ability, ...(record ? [record] : []))
    : false
}
export function mediaQuery(ctx: HttpContext) {
  const options = mediaOptions(ctx)
  if (options.tenancy && !ctx.pupitre.tenant) throw new E_PUPITRE_MEDIA_TENANT()
  const resource = ctx.pupitre.panel.resources.find((item) => item.slug === 'media')
  if (!resource) throw new E_PUPITRE_FORBIDDEN()
  return scopedQuery(ctx, resource)
}
export async function resolveMedia(ctx: HttpContext, id: unknown) {
  if (
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0 ||
    !(await authorizeMedia(ctx, 'viewAny'))
  )
    return null
  const record = (await mediaQuery(ctx).where('id', Number(id)).first()) as PupitreMedia | null
  return record && (await authorizeMedia(ctx, 'view', record)) ? record : null
}
export async function mediaPresentation(record: PupitreMedia, conversion = 'thumb') {
  const storage = createPupitreStorage(record.disk)
  return {
    id: record.id,
    filename: record.filename,
    alt: record.alt ?? '',
    title: record.title,
    caption: record.caption,
    mime: record.mime,
    width: record.width,
    height: record.height,
    url: await storage.url(record.conversions[conversion] ?? record.path, {
      visibility: record.visibility,
    }),
  }
}
async function boundedBytes(storage: PupitreStorage, path: string, limit: number) {
  const stream = await storage.getStream(path)
  const chunks: Buffer[] = []
  let size = 0
  try {
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > limit) throw new E_PUPITRE_INVALID_UPLOAD()
      chunks.push(bytes)
    }
  } finally {
    stream.destroy()
  }
  return Buffer.concat(chunks, size)
}
export async function adoptMedia(
  ctx: HttpContext,
  path: string,
  form: SchemaNodeDefinition[],
  trx?: TransactionClientContract
) {
  const options = mediaOptions(ctx)
  if (!(await authorizeMedia(ctx, 'create'))) throw new E_PUPITRE_FORBIDDEN()
  const uploads = ctx.session.get('pupitre.uploads') as
    { key: string; resource: string; field: string }[] | undefined
  if (
    !uploads?.some(
      (upload) => upload.key === path && upload.resource === 'media' && upload.field === 'path'
    )
  )
    throw new E_PUPITRE_INVALID_UPLOAD()
  // A consumed media object cannot be adopted a second time by another library record.
  if (
    await PupitreMedia.query(trx ? { client: trx } : {})
      .where('path', path)
      .first()
  )
    throw new E_PUPITRE_INVALID_UPLOAD()
  if (!trx) await consumeFormUploads(ctx, 'media', form, { path: [path] })
  const disk = options.disk ?? 'uploads'
  const storage = createPupitreStorage(disk)
  const conversions: Record<string, string> = {}
  const written: string[] = []
  try {
    const bytes = await boundedBytes(storage, path, options.maxFileSize ?? 10 * 1024 * 1024)
    const type = await sniffUploadMime(bytes)
    const field = form.find((node) => node.kind === 'fileUpload')!
    if (!type || !isUploadMimeAllowed(field, type.mime, type.ext))
      throw new E_PUPITRE_INVALID_UPLOAD()
    const converted = type.mime.startsWith('image/')
      ? await convertImage(
          bytes,
          options.conversions === false ? {} : (options.conversions ?? { thumb: { width: 320 } })
        )
      : { width: null, height: null, files: [] }
    for (const file of converted.files) {
      const key = `${path}.${randomUUID()}.${file.name}.${file.format}`
      await storage.put(key, file.contents, {
        contentType: `image/${file.format}`,
        visibility: options.visibility ?? 'private',
      })
      written.push(key)
      conversions[file.name] = key
    }
    return await PupitreMedia.create(
      {
        disk,
        directory: path.slice(0, path.lastIndexOf('/')),
        path,
        visibility: options.visibility ?? 'private',
        filename: path.slice(path.lastIndexOf('/') + 1),
        mime: type.mime,
        size: bytes.length,
        width: converted.width,
        height: converted.height,
        conversions,
        tenantId: options.tenancy ? String(ctx.pupitre.tenant!.id) : null,
        uploadedBy: ctx.pupitre.user ? String(ctx.pupitre.user.id) : null,
      },
      trx ? { client: trx } : {}
    )
  } catch (error) {
    await Promise.allSettled(written.map((key) => storage.delete(key)))
    // A concurrent adoption may have committed this same original while our insert failed.
    if (!trx && !(await PupitreMedia.query().where('path', path).first()))
      await Promise.allSettled([storage.delete(path)])
    throw error
  }
}
export async function deleteMediaFiles(record: PupitreMedia) {
  const storage = createPupitreStorage(record.disk)
  for (const path of [record.path, ...Object.values(record.conversions)]) await storage.delete(path)
}
