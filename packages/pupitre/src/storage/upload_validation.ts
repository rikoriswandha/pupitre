import { open } from 'node:fs/promises'
import { E_PUPITRE_UPLOAD_TOO_LARGE } from '../errors.js'

import type {
  FileUploadFieldDefinition,
  MarkdownEditorFieldDefinition,
  RichEditorFieldDefinition,
  SchemaNodeBuilder,
  SchemaNodeDefinition,
} from '../definition/schema.js'
import { getComponentDefinition, schema } from '../builder/schema/schema.js'
import { walkSchema } from '../definition/walk.js'
type UploadField =
  FileUploadFieldDefinition | RichEditorFieldDefinition | MarkdownEditorFieldDefinition

export function findUploadField(
  nodes: SchemaNodeDefinition[] | undefined,
  name: string
): UploadField | undefined {
  let result: UploadField | undefined
  walkSchema(
    nodes ?? [],
    (node, path) => {
      if (
        !result &&
        (node.kind === 'fileUpload' ||
          node.kind === 'richEditor' ||
          node.kind === 'markdownEditor') &&
        path === name
      ) {
        result = node
      }
    },
    {
      repeaterSchema: (node) =>
        typeof node.schema === 'function'
          ? node
              .schema(schema)
              .map((component) => getComponentDefinition(component as unknown as SchemaNodeBuilder))
          : (node.schema ?? []),
    }
  )
  return result
}

export function parseMaxSize(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') return value
  if (value === undefined || value === '') return undefined
  const match = /^(\d+(?:\.\d+)?)(kb|mb)?$/i.exec(value.trim())
  if (!match) return undefined
  const multiplier = match[2]?.toLowerCase() === 'mb' ? 1024 * 1024 : match[2] ? 1024 : 1
  return Math.floor(Number(match[1]) * multiplier)
}

/** Default ceiling also covers editor and plugin-contributed upload fields. */
export const DEFAULT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024

/** Check the actual tempfile before allocating; never buffer more than the accepted size. */
export async function readUploadBytes(path: string, maxBytes: number): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new E_PUPITRE_UPLOAD_TOO_LARGE()
  const file = await open(path, 'r')
  try {
    const { size } = await file.stat()
    if (size > maxBytes) throw new E_PUPITRE_UPLOAD_TOO_LARGE()
    const bytes = Buffer.alloc(size)
    let offset = 0
    while (offset < size) {
      const result = await file.read(bytes, offset, size - offset, offset)
      if (result.bytesRead === 0) break
      offset += result.bytesRead
    }
    // Detect growth without allocating/buffering the enlarged file.
    const extra = Buffer.alloc(1)
    const overflow = await file.read(extra, 0, 1, size)
    if (overflow.bytesRead > 0) throw new E_PUPITRE_UPLOAD_TOO_LARGE()
    return bytes.subarray(0, offset)
  } finally {
    await file.close()
  }
}

export function isPassiveImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('image/') && mime.toLowerCase() !== 'image/svg+xml'
}

export function isUploadMimeAllowed(
  field: SchemaNodeDefinition,
  mime: string,
  extension: string
): boolean {
  mime = mime.toLowerCase()
  extension = extension.toLowerCase()
  if (
    [
      'image/svg+xml',
      'text/html',
      'application/xhtml+xml',
      'text/javascript',
      'application/javascript',
    ].includes(mime) ||
    ['svg', 'html', 'htm', 'xhtml', 'js', 'mjs'].includes(extension)
  )
    return false
  if (field.kind !== 'fileUpload' && field.kind !== 'richEditor' && field.kind !== 'markdownEditor')
    return false
  if (field.kind !== 'fileUpload' || field.image) return isPassiveImageMime(mime)
  if (!field.accept) return true
  const accepts = (Array.isArray(field.accept) ? field.accept : [field.accept])
    .flatMap((accept) => accept.split(','))
    .map((accept) => accept.trim().toLowerCase())
  return accepts.some((value) => {
    if (value.endsWith('/*')) return mime.startsWith(value.slice(0, -1))
    if (value.startsWith('.')) return extension === value.slice(1)
    return value === mime.toLowerCase()
  })
}
