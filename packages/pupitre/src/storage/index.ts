import app from '@adonisjs/core/services/app'
import type { DriveService } from '@adonisjs/drive/types'
import type {
  FileUploadFieldDefinition,
  MarkdownEditorFieldDefinition,
  RichEditorFieldDefinition,
} from '../definition/schema.js'
import type { Readable } from 'node:stream'

export type UploadField =
  FileUploadFieldDefinition | RichEditorFieldDefinition | MarkdownEditorFieldDefinition

export interface PupitreStorage {
  put(
    key: string,
    contents: Uint8Array,
    options: { contentType: string; visibility: 'public' | 'private' }
  ): Promise<void>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  url(key: string, options: { visibility: 'public' | 'private' }): Promise<string>
  getStream(key: string): Promise<Readable>
}

export function createPupitreStorage(diskName?: string): PupitreStorage {
  const getDisk = async () => {
    const manager = (await app.container.make('drive.manager')) as DriveService
    const config = (await app.container.make('pupitre.config')) as
      { storage?: { disk?: string } } | undefined
    return manager.use(diskName ?? config?.storage?.disk)
  }
  return {
    async put(key, contents, options) {
      const disk = await getDisk()
      await disk.put(key, contents, options)
    },
    async delete(key) {
      const disk = await getDisk()
      await disk.delete(key)
    },
    async exists(key) {
      const disk = await getDisk()
      return disk.exists(key)
    },
    async getStream(key) {
      const disk = await getDisk()
      return disk.getStream(key)
    },
    async url(key, options) {
      const disk = await getDisk()
      return options.visibility === 'private'
        ? disk.getSignedUrl(key, { expiresIn: '30m' })
        : disk.getUrl(key)
    },
  }
}

function fieldDisk(field: UploadField): string | undefined {
  return field.kind === 'fileUpload' ? field.disk : field.fileAttachmentsDisk
}

export async function resolveFileUrl(key: string, field: UploadField): Promise<string | null> {
  const storage = createPupitreStorage(fieldDisk(field))
  if (!(await storage.exists(key))) return null
  return storage.url(key, {
    visibility: field.kind === 'fileUpload' ? (field.visibility ?? 'public') : 'public',
  })
}

function keys(value: unknown): Set<string> {
  if (typeof value === 'string' && value.length > 0) return new Set([value])
  if (Array.isArray(value)) return new Set(value.flatMap((item) => [...keys(item)]))
  if (value && typeof value === 'object' && 'key' in value) return keys(value.key)
  return new Set()
}

export async function cleanupReplacedFiles(
  field: UploadField,
  oldValue: unknown,
  newValue: unknown
): Promise<void> {
  const removed = keys(oldValue)
  for (const key of keys(newValue)) removed.delete(key)
  if (removed.size === 0) return

  const storage = createPupitreStorage(fieldDisk(field))
  await Promise.all([...removed].map((key) => storage.delete(key)))
}
