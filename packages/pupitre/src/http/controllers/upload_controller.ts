import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { MultipartFile } from '@adonisjs/bodyparser'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import { fileTypeFromBuffer } from 'file-type'
import {
  E_PUPITRE_FORBIDDEN,
  E_PUPITRE_INVALID_UPLOAD,
  E_PUPITRE_UPLOAD_NOT_OWNED,
  E_PUPITRE_UPLOAD_TOO_LARGE,
} from '../../errors.js'
import type { ResourceRuntime } from '../../manager.js'
import { authorizeResource } from '../../authz/bouncer.js'
import { createPupitreStorage, resolveFileUrl } from '../../storage/index.js'
import {
  findUploadField,
  isUploadMimeAllowed,
  parseMaxSize,
  DEFAULT_UPLOAD_MAX_BYTES,
  readUploadBytes,
} from '../../storage/upload_validation.js'
import { scopedQuery } from '../../query/scoped_query.js'

import { findFormOwner } from '../../pages/form_owner.js'
type UploadedSessionFile = {
  key: string
  resource: string
  field: string
  ability: 'create' | 'update'
  recordId?: string
}
type UploadRequestContext = HttpContext & {
  session: {
    get(key: string): unknown
    put(key: string, value: unknown): void
  }
}

function safeDirectory(value: string): string {
  return value
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, '-'))
    .join('/')
}
async function findRecord(
  ctx: HttpContext,
  resource: ResourceRuntime,
  id: unknown
): Promise<LucidRow | null> {
  if (typeof id !== 'string' && typeof id !== 'number') return null
  const keyName = (resource.model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
  return scopedQuery(ctx, resource).where(keyName, id).first()
}

export default class UploadController {
  async store(ctx: HttpContext) {
    const context = ctx as UploadRequestContext
    const resourceSlug = ctx.request.input('resource')
    const fieldName = ctx.request.input('field')
    if (typeof resourceSlug !== 'string' || typeof fieldName !== 'string') {
      return ctx.response.status(422).json({ message: 'A resource and field are required' })
    }

    const owner = findFormOwner(ctx, resourceSlug)
    if (!owner) return ctx.response.status(404).json({ message: 'Form owner not found' })
    const resource =
      owner.kind === 'resource'
        ? context.pupitre.panel.resources.find((candidate) => candidate.slug === resourceSlug)
        : undefined
    const field = findUploadField(owner.form, fieldName)
    if (!field) return ctx.response.status(404).json({ message: 'Upload field not found' })

    let record: LucidRow | undefined
    let ability: UploadedSessionFile['ability'] = 'create'
    const recordId = ctx.request.input('record')
    if (
      recordId !== undefined &&
      recordId !== null &&
      typeof recordId !== 'string' &&
      typeof recordId !== 'number'
    ) {
      return ctx.response.status(422).json({ message: 'The record identifier is invalid' })
    }
    if (owner.kind === 'resource') {
      if (!resource) return ctx.response.status(404).json({ message: 'Resource not found' })
      if (recordId !== undefined && recordId !== null && recordId !== '') {
        if (!(await authorizeResource(ctx, resource, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
        record = (await findRecord(ctx, resource, recordId)) ?? undefined
        if (!record) return ctx.response.status(404).json({ message: 'Record not found' })
      }
      ability = record ? 'update' : 'create'
      if (!(await authorizeResource(ctx, resource, ability, record)))
        throw new E_PUPITRE_FORBIDDEN()
    } else {
      if (recordId !== undefined && recordId !== null && recordId !== '')
        return ctx.response.status(422).json({ message: 'Page uploads do not accept a record' })
      await owner.authorize('create')
    }

    const file = ctx.request.file('file') as MultipartFile | null
    if (!file || !file.tmpPath || file.errors.length > 0) {
      throw new E_PUPITRE_INVALID_UPLOAD()
    }
    const limit =
      parseMaxSize(field.kind === 'fileUpload' ? field.maxSize : undefined) ??
      DEFAULT_UPLOAD_MAX_BYTES
    if (file.size > limit) throw new E_PUPITRE_UPLOAD_TOO_LARGE()
    const bytes = await readUploadBytes(file.tmpPath, limit)

    const sniffed = await fileTypeFromBuffer(bytes)
    if (!sniffed || !isUploadMimeAllowed(field, sniffed.mime, sniffed.ext))
      throw new E_PUPITRE_INVALID_UPLOAD()
    const configuredDirectory =
      field.kind === 'fileUpload' ? field.directory : field.fileAttachmentsDirectory
    const fieldDirectory = fieldName.replaceAll('.', '/')
    const prefix =
      safeDirectory(configuredDirectory || `${resourceSlug}/${fieldDirectory}`) || resourceSlug
    const key = `${prefix}/${randomUUID()}.${sniffed.ext}`
    const sessionUploads = context.session.get('pupitre.uploads')
    const currentUploads = Array.isArray(sessionUploads) ? sessionUploads : []
    if (currentUploads.length >= 50)
      return ctx.response.status(429).json({
        message:
          'Upload session limit reached. Save the form or remove an uploaded file before uploading more.',
      })
    const visibility = field.kind === 'fileUpload' ? (field.visibility ?? 'public') : 'public'
    const storage = createPupitreStorage(
      field.kind === 'fileUpload' ? field.disk : field.fileAttachmentsDisk
    )
    await storage.put(key, bytes, { contentType: sniffed.mime, visibility })
    const url = await resolveFileUrl(key, field)
    if (!url) {
      await storage.delete(key)
      throw new E_PUPITRE_INVALID_UPLOAD()
    }

    const uploaded = context.session.get('pupitre.uploads')
    const uploads = Array.isArray(uploaded)
      ? uploaded.filter((item): item is UploadedSessionFile =>
          Boolean(
            item &&
            typeof item === 'object' &&
            'key' in item &&
            'resource' in item &&
            'field' in item &&
            'ability' in item &&
            (item.ability === 'create' || item.ability === 'update')
          )
        )
      : []
    uploads.push({
      key,
      resource: resourceSlug,
      field: fieldName,
      ability,
      ...(recordId === undefined || recordId === null || recordId === ''
        ? {}
        : { recordId: String(recordId) }),
    })
    context.session.put('pupitre.uploads', uploads)

    return ctx.response.ok({
      key,
      url,
      name: file.clientName,
      size: bytes.byteLength,
      mime: sniffed.mime,
    })
  }

  async destroy(ctx: HttpContext) {
    const context = ctx as UploadRequestContext
    const key = ctx.request.input('key')
    if (typeof key !== 'string' || key.length === 0)
      return ctx.response.status(422).json({ message: 'A file key is required' })
    const uploaded = context.session.get('pupitre.uploads')
    const uploads = Array.isArray(uploaded) ? (uploaded as UploadedSessionFile[]) : []
    const own = uploads.find((upload) => upload.key === key)
    if (!own) throw new E_PUPITRE_UPLOAD_NOT_OWNED()

    const owner = findFormOwner(ctx, own.resource)
    const resource =
      owner?.kind === 'resource'
        ? context.pupitre.panel.resources.find((candidate) => candidate.slug === own.resource)
        : undefined
    const field = owner ? findUploadField(owner.form, own.field) : undefined
    if (!owner || !field) throw new E_PUPITRE_UPLOAD_NOT_OWNED()
    if (owner.kind === 'resource' && resource) {
      let record: LucidRow | undefined
      if (own.ability === 'update') {
        if (!(await authorizeResource(ctx, resource, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
        record = (await findRecord(ctx, resource, own.recordId)) ?? undefined
        if (!record) throw new E_PUPITRE_UPLOAD_NOT_OWNED()
      }
      if (!(await authorizeResource(ctx, resource, own.ability, record)))
        throw new E_PUPITRE_FORBIDDEN()
    } else {
      await owner.authorize(own.ability)
    }
    const storage = createPupitreStorage(
      field.kind === 'fileUpload' ? field.disk : field.fileAttachmentsDisk
    )
    await storage.delete(key)
    context.session.put(
      'pupitre.uploads',
      uploads.filter((upload) => upload.key !== key)
    )
    return ctx.response.noContent()
  }
}
