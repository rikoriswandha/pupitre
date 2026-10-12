import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { Database } from '@adonisjs/lucid/database'
import type { SchemaNodeDefinition } from '../definition/schema.js'
import { walkSchema } from '../definition/walk.js'
import { valuesAt } from '../definition/values_at.js'
import { createPupitreStorage, fileKeys, uploadFields } from './index.js'
import { E_PUPITRE_INVALID_UPLOAD } from '../errors.js'
import { findUploadField } from './upload_validation.js'
import { referencedFileKeys } from './record_files.js'
import type PupitreManager from '../manager.js'

let warned = false
const availableConnections = new WeakSet<object>()
export async function uploadDatabase(required = false): Promise<Database | undefined> {
  const database = (await app.container.make('lucid.db')) as Database
  const connection = database.connection()
  const identity = database.getRawConnection(connection.connectionName)!.connection!
  if (availableConnections.has(identity)) return database
  if (await connection.schema.hasTable('pupitre_uploads')) {
    availableConnections.add(identity)
    return database
  }
  if (required)
    throw new Error(
      'Run the Pupitre upload migration before pruning uploads (node ace pupitre:install && node ace migration:run).'
    )
  if (!warned) {
    warned = true
    const logger = await app.container.make('logger')
    logger.warn(
      'Pupitre abandoned-upload cleanup is disabled: run pupitre:install and migration:run to create pupitre_uploads'
    )
  }
}

export async function trackUpload(
  ctx: HttpContext,
  key: string,
  resource: string,
  field: string,
  disk?: string
) {
  const database = await uploadDatabase()
  if (!database) return
  const config = (await app.container.make('pupitre.config')) as { storage?: { disk?: string } }
  await database.table('pupitre_uploads').insert({
    key,
    disk: disk ?? config.storage?.disk ?? app.config.get<string>('drive.default') ?? null,
    owner: ctx.session.sessionId,
    panel: ctx.pupitre.panel.id,
    resource,
    field,
    created_at: Date.now(),
    consumed_at: null,
  })
}

export async function forgetUpload(key: string) {
  const database = await uploadDatabase()
  if (database) await database.from('pupitre_uploads').where('key', key).delete()
}

/** Reserve before host persistence: failed saves deliberately retain their objects. */
export async function consumeFormUploads(
  ctx: HttpContext,
  owner: string,
  form: SchemaNodeDefinition[],
  data: Record<string, unknown>
) {
  const uploads = (ctx.session.get('pupitre.uploads') ?? []) as {
    resource: string
    field: string
    key: string
  }[]
  if (!uploads.some((upload) => upload.resource === owner)) return
  const submitted = new Map<string, Set<string> | undefined>()
  for (const field of uploadFields(form))
    submitted.set(field.name, fileKeys(valuesAt(data, field.name)))
  walkSchema(form, (field, path) => {
    if (
      (field.kind === 'richEditor' || field.kind === 'markdownEditor') &&
      valuesAt(data, path).some((value) => value !== undefined)
    )
      submitted.set(path, undefined)
  })
  if (!submitted.size) return
  const database = await uploadDatabase()
  if (!database) return
  for (const upload of uploads) {
    if (upload.resource !== owner || !submitted.has(upload.field)) continue
    const keys = submitted.get(upload.field)
    if (keys && !keys.has(upload.key)) continue
    const updated = await database
      .from('pupitre_uploads')
      .where('key', upload.key)
      .where((query) => query.whereNull('consumed_at').orWhere('consumed_at', '>=', 0))
      .update({ consumed_at: Date.now() })
    if (!updated) {
      if (await database.from('pupitre_uploads').where('key', upload.key).first())
        throw new E_PUPITRE_INVALID_UPLOAD()
      // Pre-upgrade session uploads have no tracker; require their bytes to still exist.
      const field = findUploadField(form, upload.field)
      const disk = field?.kind === 'fileUpload' ? field.disk : field?.fileAttachmentsDisk
      if (!(await createPupitreStorage(disk).exists(upload.key)))
        throw new E_PUPITRE_INVALID_UPLOAD()
    }
  }
}

export async function pruneTrackedUploads(
  olderThan: number,
  limit = 100,
  onError: (error: unknown, key: string) => void = () => {},
  onSkipped: (key: string) => void = () => {}
): Promise<number> {
  const database = await uploadDatabase(true)
  let deleted = 0
  const cutoff = Date.now() - olderThan
  // Retained rows do not use processing capacity, but scans remain bounded.
  const maxExamined = limit * 10
  let examined = 0
  let processed = 0
  let cursor: { createdAt: string | number; key: string } | undefined
  const manager = (await app.container.make('pupitre.manager')) as PupitreManager
  while (processed < limit && examined < maxExamined) {
    const candidates = database!
      .from('pupitre_uploads')
      .where((query) => query.whereNull('consumed_at').orWhere('consumed_at', -1))
      .where('created_at', '<', cutoff)
      .orderBy('created_at')
      .orderBy('key')
      .limit(Math.min(limit - processed, maxExamined - examined))
    if (cursor) {
      const { createdAt, key } = cursor
      candidates.where((page) =>
        page
          .where('created_at', '>', createdAt)
          .orWhere((tie) => tie.where('created_at', createdAt).where('key', '>', key))
      )
    }
    const uploads = await candidates
    if (!uploads.length) break
    const last = uploads[uploads.length - 1]
    // Capture before claims update timestamps or deletes remove the cursor row.
    cursor = { createdAt: last.created_at, key: last.key }
    examined += uploads.length
    const referenced = new Set<string>()
    const skipped = new Set<string>()
    const failed = new Set<string>()
    // Batch only candidates belonging to the same configured resource and field.
    const groups = new Map<string, typeof uploads>()
    for (const upload of uploads) {
      const identity = JSON.stringify([upload.panel, upload.resource, upload.field])
      const group = groups.get(identity) ?? []
      group.push(upload)
      groups.set(identity, group)
    }
    for (const group of groups.values()) {
      const upload = group[0]
      const panel = manager.panels.find((item) => item.id === upload.panel)
      const resource = panel?.resources.find((item) => item.slug === upload.resource)
      const page = panel?.pages.find((item) => item.slug === upload.resource)
      const form = resource?.definition.form ?? page?.definition.form ?? []
      const uploadField = findUploadField(form, upload.field)
      if (uploadField && uploadField.kind !== 'fileUpload') continue
      const field = uploadFields(form).find((item) => item.name === upload.field)
      resource?.model.boot()
      if (
        !resource ||
        !field ||
        field.relationshipPath ||
        !resource.model.$hasColumn(field.name.split('.')[0])
      ) {
        for (const item of group) {
          skipped.add(item.key)
          onSkipped(item.key)
        }
        continue
      }
      try {
        for (const key of await referencedFileKeys(
          resource.model,
          field,
          new Set(group.map((item) => item.key))
        ))
          referenced.add(key)
      } catch (error) {
        for (const item of group) {
          failed.add(item.key)
          onError(error, item.key)
        }
      }
    }
    for (const upload of uploads) {
      if (failed.has(upload.key) || skipped.has(upload.key)) continue
      try {
        if (referenced.has(upload.key)) {
          await database!
            .from('pupitre_uploads')
            .where('key', upload.key)
            .where((query) => query.whereNull('consumed_at').orWhere('consumed_at', -1))
            .update({ consumed_at: Date.now() })
          continue
        }
        // A committed conditional update is the claim; no locks span reference scans or Drive I/O.
        // Negative consumed_at cannot be adopted by a concurrent form submission.
        const claimed = await database!
          .from('pupitre_uploads')
          .where('key', upload.key)
          .where((query) => query.whereNull('consumed_at').orWhere('consumed_at', -1))
          .where('created_at', upload.created_at)
          .update({ consumed_at: -1, created_at: Date.now() })
        if (!claimed) continue
        try {
          await createPupitreStorage(upload.disk ?? undefined).delete(upload.key)
        } catch (error) {
          await database!
            .from('pupitre_uploads')
            .where('key', upload.key)
            .where('consumed_at', -1)
            .update({ consumed_at: null, created_at: upload.created_at })
          throw error
        }
        await database!
          .from('pupitre_uploads')
          .where('key', upload.key)
          .where('consumed_at', -1)
          .delete()
        deleted++
      } catch (error) {
        onError(error, upload.key)
      }
    }
    processed += uploads.length - skipped.size
  }
  return deleted
}
