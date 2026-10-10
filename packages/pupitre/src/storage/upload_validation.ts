import type {
  FileUploadFieldDefinition,
  RichEditorFieldDefinition,
  SchemaNodeBuilder,
  SchemaNodeDefinition,
} from '../definition/schema.js'
import { getComponentDefinition, schema } from '../builder/schema/schema.js'
type UploadField = FileUploadFieldDefinition | RichEditorFieldDefinition

export function findUploadField(
  nodes: SchemaNodeDefinition[] | undefined,
  name: string
): UploadField | undefined {
  const find = (
    items: SchemaNodeDefinition[] | undefined,
    prefix: string
  ): UploadField | undefined => {
    for (const node of items ?? []) {
      const path = 'name' in node ? [prefix, node.name].filter(Boolean).join('.') : prefix
      if (
        (node.kind === 'fileUpload' || node.kind === 'richEditor') &&
        (node.name === name || path === name)
      ) {
        return node
      }
      if ('children' in node) {
        const found = find(node.children, prefix)
        if (found) return found
      }
      if (node.kind === 'repeater') {
        const nested =
          typeof node.schema === 'function'
            ? node
                .schema(schema)
                .map((component) =>
                  getComponentDefinition(component as unknown as SchemaNodeBuilder)
                )
            : (node.schema ?? [])
        const found = find(nested, path)
        if (found) return found
      }
    }
    return undefined
  }
  return find(nodes, '')
}

export function parseMaxSize(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') return value
  if (value === undefined || value === '') return undefined
  const match = /^(\d+(?:\.\d+)?)(kb|mb)?$/i.exec(value.trim())
  if (!match) return undefined
  const multiplier = match[2]?.toLowerCase() === 'mb' ? 1024 * 1024 : match[2] ? 1024 : 1
  return Math.floor(Number(match[1]) * multiplier)
}

export function isUploadMimeAllowed(
  field: SchemaNodeDefinition,
  mime: string,
  extension: string
): boolean {
  if (field.kind !== 'fileUpload' && field.kind !== 'richEditor') return false
  if (field.kind === 'richEditor' || field.image) return mime.startsWith('image/')
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
