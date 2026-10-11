import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import type {
  FieldDefinitionUnion,
  SchemaNodeDefinition,
  SchemaNodeBuilder,
} from '../../definition/schema.js'
import { getComponentDefinition, schema as schemaFactory } from '../../builder/schema/schema.js'
import { E_PUPITRE_FORBIDDEN } from '../../errors.js'
import { authorizeResource } from '../../authz/bouncer.js'
import { findFormOwner } from '../../pages/form_owner.js'
import { scopedQuery } from '../../query/scoped_query.js'
import { evaluateClosure } from '../../compiler/closure_lifter.js'
import type { ResourceRuntime } from '../../manager.js'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { walkSchema } from '../../definition/walk.js'

const evaluationRequest = vine.compile(
  vine.object({
    resource: vine.string().trim().minLength(1),
    page: vine.enum(['create', 'edit', 'page'] as const),
    field: vine.string().trim().minLength(1),
    state: vine.object({}).allowUnknownProperties(),
    record: vine.unionOfTypes([vine.string(), vine.number()]).optional(),
  })
)

type FieldMatch = {
  field: FieldDefinitionUnion
  pattern: string
  actual: string
  builderScoped: boolean
}
function repeaterSchema(
  schema: Extract<SchemaNodeDefinition, { kind: 'repeater' }>['schema']
): SchemaNodeDefinition[] {
  if (!schema || typeof schema !== 'function') return schema ?? []
  return (
    schema(schemaFactory as never) as unknown as (SchemaNodeDefinition | SchemaNodeBuilder)[]
  ).map((child) => {
    const builder = child as SchemaNodeBuilder
    return typeof builder.toDefinition === 'function'
      ? getComponentDefinition(builder)
      : (child as SchemaNodeDefinition)
  })
}
function collectFields(
  nodes: SchemaNodeDefinition[],
  prefix = ''
): Array<{ field: FieldDefinitionUnion; pattern: string; builderScoped: boolean }> {
  const result: Array<{ field: FieldDefinitionUnion; pattern: string; builderScoped: boolean }> = []
  const repeaters: string[] = []
  const builderBlocks: { path: string; name: string }[] = []
  const transformBuilderPath = (path: string) => {
    let transformed = prefix ? `${prefix}.${path}` : path
    for (const block of [...builderBlocks].reverse()) {
      const blockPrefix = `${prefix ? `${prefix}.` : ''}${block.path}.${block.name}.data.`
      if (transformed.startsWith(blockPrefix))
        transformed = `${prefix ? `${prefix}.` : ''}${block.path}.*.data.${transformed.slice(blockPrefix.length)}`
    }
    return transformed
  }
  walkSchema(
    nodes,
    (node, path) => {
      if (node.kind === 'builder')
        for (const block of node.blocks) builderBlocks.push({ path, name: block.name })
      if (node.kind === 'repeater') repeaters.push(transformBuilderPath(path))
      if (
        'name' in node &&
        node.name &&
        [
          'text',
          'email',
          'password',
          'number',
          'textarea',
          'hidden',
          'select',
          'multiSelect',
          'checkbox',
          'checkboxList',
          'radio',
          'toggle',
          'toggleButtons',
          'date',
          'dateTime',
          'time',
          'color',
          'tags',
          'keyValue',
          'richEditor',
          'fileUpload',
        ].includes(node.kind)
      ) {
        let pattern = transformBuilderPath(path)
        const builderScoped = pattern.includes('.*.data.')
        for (const repeater of repeaters) {
          const nestedPrefix = prefix ? `${prefix}.${repeater}` : repeater
          if (pattern.startsWith(`${nestedPrefix}.`))
            pattern = `${nestedPrefix}.*.${pattern.slice(nestedPrefix.length + 1)}`
        }
        result.push({ field: node as FieldDefinitionUnion, pattern, builderScoped })
      }
    },
    { repeaterSchema: (node) => repeaterSchema(node.schema) }
  )
  return result
}
function matchField(nodes: SchemaNodeDefinition[], actual: string): FieldMatch | undefined {
  const parts = actual.split('.')
  if (parts.some((part) => !part || part === '..')) return undefined
  const match = collectFields(nodes).find(({ pattern }) => {
    const expected = pattern.split('.')
    return (
      expected.length === parts.length &&
      expected.every((part, index) =>
        part === '*' ? /^\d+$/.test(parts[index]!) : part === parts[index]
      )
    )
  })
  return match ? { ...match, actual } : undefined
}
function atPath(value: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[part]
          : undefined,
      value
    )
}
function pointer(path: string): string {
  return `/data/${path
    .split('.')
    .map((part) => part.replaceAll('~', '~0').replaceAll('/', '~1'))
    .join('/')}`
}
function isAllowedTarget(
  field: FieldDefinitionUnion,
  state: Record<string, unknown>,
  record: LucidRow | null,
  ctx: HttpContext
): boolean {
  if (field.kind === 'hidden' || field.disabled === true) return false
  const recordData = record as unknown as Record<string, unknown> | null
  if (
    typeof field.disabled === 'function' &&
    evaluateClosure(field.disabled, state, recordData, ctx)
  )
    return false
  if (typeof field.hidden === 'function' && evaluateClosure(field.hidden, state, recordData, ctx))
    return false
  if (
    typeof field.visible === 'function' &&
    !evaluateClosure(field.visible, state, recordData, ctx)
  )
    return false
  return true
}

export default class EvaluateController {
  async evaluate(ctx: HttpContext) {
    const input = await evaluationRequest.validate(ctx.request.all())
    const owner = findFormOwner(ctx, input.resource)
    if (!owner) return ctx.response.notFound({ message: 'Unknown Pupitre form.' })
    const resource = ctx.pupitre.panel.resources.find(
      (candidate: ResourceRuntime) => candidate.slug === input.resource
    )
    let record: LucidRow | null = null
    if (owner.kind === 'resource') {
      if (!resource) return ctx.response.notFound({ message: 'Unknown Pupitre resource.' })
      if (input.page !== 'create' && input.page !== 'edit')
        return ctx.response.notFound({ message: 'Unknown Pupitre form page.' })
      if (input.page === 'create' && !(await authorizeResource(ctx, resource, 'create')))
        throw new E_PUPITRE_FORBIDDEN()
      if (input.page === 'edit') {
        if (input.record === undefined)
          return ctx.response.notFound({ message: 'Record not found.' })
        record =
          (await scopedQuery(ctx, resource)
            .where(resource.model.primaryKey, input.record)
            .first()) ?? null
        if (!record) return ctx.response.notFound({ message: 'Record not found.' })
        if (!(await authorizeResource(ctx, resource, 'update', record)))
          throw new E_PUPITRE_FORBIDDEN()
      }
    } else {
      if (input.page !== 'page' || input.record !== undefined)
        return ctx.response.notFound({ message: 'Unknown custom-page form.' })
      await owner.authorize('create')
    }
    const match = matchField(owner.form, input.field)
    if (
      !match ||
      typeof match.field.afterStateUpdated !== 'function' ||
      !(typeof match.field.live === 'object' && match.field.live.server === true)
    )
      return ctx.response.notFound({ message: 'Unknown server-evaluated field.' })
    const fieldParts = match.actual.split('.')
    const templateParts = match.pattern.split('.')
    const repeaterOffset = templateParts.lastIndexOf('*')
    const baseParts = repeaterOffset < 0 ? [] : fieldParts.slice(0, repeaterOffset + 1)
    if (match.builderScoped && templateParts.indexOf('*') === repeaterOffset && repeaterOffset >= 0)
      baseParts.push('data')
    const basePath = baseParts.join('.')
    const localState = basePath ? atPath(input.state, basePath) : input.state
    const scopedState =
      localState && typeof localState === 'object'
        ? (localState as Record<string, unknown>)
        : input.state
    const requested: Record<string, unknown> = {}
    const callback = match.field.afterStateUpdated
    await callback({
      state: atPath(input.state, match.actual),
      old: undefined,
      get: (path) => atPath(scopedState, path),
      set: (path, value) => {
        const segments = path.split('.')
        if (segments.some((segment) => !segment || segment === '..' || segment.startsWith('/')))
          return
        const targetPath = [basePath, ...segments].filter(Boolean).join('.')
        const target = matchField(owner.form, targetPath)
        if (target && isAllowedTarget(target.field, input.state, record, ctx))
          requested[targetPath] = value
      },
      record: record as unknown as Record<string, unknown> | null,
      ctx,
    })
    const set: Record<string, unknown> = {}
    for (const [targetPath, value] of Object.entries(requested)) set[pointer(targetPath)] = value
    return ctx.response.ok({ set })
  }
}
