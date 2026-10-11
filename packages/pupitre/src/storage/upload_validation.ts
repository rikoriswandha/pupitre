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

export function isUploadMimeAllowed(
  field: SchemaNodeDefinition,
  mime: string,
  extension: string
): boolean {
  if (field.kind !== 'fileUpload' && field.kind !== 'richEditor' && field.kind !== 'markdownEditor')
    return false
  if (field.kind !== 'fileUpload' || field.image) return mime.startsWith('image/')
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
