type SelectField = Extract<FieldDefinitionUnion, { kind: 'select' | 'multiSelect' }>
import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import type { Database } from '@adonisjs/lucid/database'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { FieldContext } from '@vinejs/vine/types'
import { DateTime } from 'luxon'
import type {
  FieldDefinitionUnion,
  RepeaterFieldDefinition,
  SchemaNamespace,
  SchemaNodeBuilder,
  SchemaNodeDefinition,
  ValidationRules,
} from '../definition/schema.js'
import { getComponentDefinition, schema as schemaFactory } from '../builder/schema/schema.js'
import { parseInZone } from '../format/index.js'
import { sanitizeHtml } from '../sanitize.js'
import { scopedQuery } from '../query/scoped_query.js'
type ValidatorOptions = {
  record?: LucidRow | null
  /** Resource model: default table + attribute→column mapping for `unique` on create. */
  model?: LucidModel | null
  ctx?: HttpContext
  timezone: string
}
export type FormValidator = {
  validate(data: unknown, options: ValidatorOptions): Promise<Record<string, unknown>>
}

type FieldRecord = { field: FieldDefinitionUnion; path: string; repeatPath?: string }
const validators = new WeakMap<SchemaNodeDefinition[], FormValidator>()
const uploadSessionKey = 'pupitre.uploads'
type UploadedSessionFile = {
  key: string
  resource: string
  field: string
  ability: 'create' | 'update'
  recordId?: string
}
type ValidatorContext = HttpContext & {
  session?: { get(key: string): unknown }
  pupitre?: {
    panel?: {
      resources?: { slug: string; definition: { form: SchemaNodeDefinition[] } }[]
      pages?: { slug: string; definition: { form?: SchemaNodeDefinition[] } }[]
    }
  }
}

function resourceSlug(nodes: SchemaNodeDefinition[], ctx?: HttpContext): string | undefined {
  const panel = (ctx as ValidatorContext | undefined)?.pupitre?.panel
  const resource = panel?.resources?.find((item) => item.definition.form === nodes)
  if (resource) return resource.slug
  return panel?.pages?.find((item) => item.definition.form === nodes)?.slug
}

function persistedAt(record: Record<string, unknown> | null, path: string): unknown[] {
  let values: unknown[] = [record]
  for (const segment of path.split('.')) {
    values = values.flatMap((value) => {
      if (Array.isArray(value))
        return value.map((item) => (item as Record<string, unknown>)?.[segment])
      if (value === null || typeof value !== 'object') return []
      return [(value as Record<string, unknown>)[segment]]
    })
  }
  return values
}

function sessionUploads(ctx: HttpContext | undefined): UploadedSessionFile[] {
  const uploads = (ctx as ValidatorContext | undefined)?.session?.get(uploadSessionKey)
  if (!Array.isArray(uploads)) return []
  return uploads.filter((item): item is UploadedSessionFile =>
    Boolean(
      item &&
      typeof item === 'object' &&
      'key' in item &&
      typeof item.key === 'string' &&
      'resource' in item &&
      typeof item.resource === 'string' &&
      'field' in item &&
      typeof item.field === 'string' &&
      'ability' in item &&
      (item.ability === 'create' || item.ability === 'update')
    )
  )
}

function isUploadedFileKey(value: unknown, targetField: string, vineField: FieldContext): boolean {
  if (typeof value !== 'string') return true
  const meta = vineField.meta as
    { ctx?: HttpContext; resource?: string; record?: LucidRow | null } | undefined
  const record = meta?.record?.serialize() ?? null
  const previous = persistedAt(record, targetField)
  if (previous.some((item) => (Array.isArray(item) ? item.includes(value) : item === value)))
    return true
  return sessionUploads(meta?.ctx).some(
    (upload) =>
      upload.key === value && upload.resource === meta?.resource && upload.field === targetField
  )
}

function timeIsValid(value: string): boolean {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return false
  const [, hours, minutes, seconds = '00'] = match
  return Number(hours) < 24 && Number(minutes) < 60 && Number(seconds) < 60
}
function normalizeOptions(value: unknown): unknown[] {
  if (Array.isArray(value))
    return value.map((option) =>
      option && typeof option === 'object' && 'value' in option ? option.value : option
    )
  if (value && typeof value === 'object') return Object.keys(value)
  return []
}

function stringComparableEnum(options: unknown[]) {
  return vine
    .any()
    .use(
      vine.createRule((value: unknown, _args: unknown, vineField: FieldContext) => {
        if (!options.some((option) => String(option) === String(value))) {
          vineField.report('The selected {{ field }} is invalid', 'enum', vineField)
        }
      })()
    )
    .transform((value: unknown) => options.find((option) => String(option) === String(value)))
}

function stringComparableEnumArray(options: unknown[]) {
  const item = options.length ? stringComparableEnum(options) : vine.any()
  return vine.array(item)
}

function addRules(schema: any, field: FieldDefinitionUnion): any {
  const rules: ValidationRules = field.rules ?? {}
  if (rules.minLength !== undefined && typeof schema.minLength === 'function')
    schema = schema.minLength(rules.minLength)
  if (rules.maxLength !== undefined && typeof schema.maxLength === 'function')
    schema = schema.maxLength(rules.maxLength)
  if (rules.min !== undefined && typeof schema.min === 'function') schema = schema.min(rules.min)
  if (rules.max !== undefined && typeof schema.max === 'function') schema = schema.max(rules.max)
  if (rules.step !== undefined && field.kind === 'number') {
    const decimals = (String(rules.step).split('.')[1] ?? '').length
    schema = schema.decimal(decimals)
  }
  if (rules.email && typeof schema.email === 'function') schema = schema.email()
  if (rules.url && typeof schema.url === 'function') schema = schema.url()
  if (rules.regex && typeof schema.regex === 'function')
    schema = schema.regex(typeof rules.regex === 'string' ? new RegExp(rules.regex) : rules.regex)
  if (rules.alpha && typeof schema.alpha === 'function') schema = schema.alpha()
  if (rules.alphaNumeric && typeof schema.alphaNumeric === 'function')
    schema = schema.alphaNumeric()
  if (rules.in && typeof schema.enum === 'function')
    schema = schema.enum(rules.in as [any, ...any[]])
  else if (rules.in && typeof schema.in === 'function') schema = schema.in(rules.in)
  if (rules.same && typeof schema.sameAs === 'function') schema = schema.sameAs(rules.same)
  if (rules.different && typeof schema.notSameAs === 'function')
    schema = schema.notSameAs(rules.different)
  if (rules.confirmed && typeof schema.confirmed === 'function') schema = schema.confirmed()
  if (rules.unique) {
    const { unique } = rules
    schema = schema.unique(async (database: Database, value: unknown, vineField: FieldContext) => {
      if (typeof value !== 'string' && typeof value !== 'number') return true
      const meta = vineField.meta as
        { record?: LucidRow | null; model?: LucidModel | null } | undefined
      const record = meta?.record ?? null
      const model = meta?.model ?? (record?.constructor as LucidModel | undefined) ?? null
      const toColumn = (attribute: string) =>
        model?.$keys.attributesToColumns.get(attribute) ?? attribute
      const table = unique.table ?? model?.table
      if (!table) throw new Error(`The unique rule for "${vineField.name}" requires a table name`)
      const column = unique.column ?? toColumn(String(vineField.name))
      const query = database
        .connection()
        .from(table)
        .select(column)
        .whereRaw('?? = ?', [column, value])
      if (unique.ignoreRecord && record && model) {
        const key = record.$primaryKeyValue
        if (typeof key === 'string' || typeof key === 'number') {
          query.whereRaw('?? != ?', [toColumn(model.primaryKey), key])
        }
      }
      return !(await query.first())
    })
  }
  if (rules.exists) schema = schema.exists(rules.exists)
  for (const custom of rules.custom ?? []) {
    if (typeof custom === 'function') schema = schema.use(custom)
    else if (custom && typeof custom === 'object' && 'rule' in custom)
      schema = schema.use(custom as never)
  }
  return schema
}

function applyPresence(schema: any, field: FieldDefinitionUnion): any {
  const rules = field.rules ?? {}
  const conditionalRequired =
    field.dehydratedWhenHidden === false ||
    (field.disabled !== undefined && field.dehydrated !== true)
  const nullable =
    rules.nullable || field.dehydrated === false || !rules.required || conditionalRequired
  if (nullable) schema = schema.nullable()
  if (field.dehydrated === false || !rules.required) return schema.optional()
  if (conditionalRequired) {
    return schema.optional().requiredWhen((vineField: FieldContext) => {
      const meta = vineField.meta as
        { record?: Record<string, unknown> | null; ctx?: HttpContext } | undefined
      const record = meta?.record ?? null
      const hiddenField = hidden(field, vineField.data, vineField.data, record, meta?.ctx)
      const disabled =
        field.disabled === true ||
        (typeof field.disabled === 'function' &&
          field.disabled({
            get: (path) => getAt(vineField.data, path),
            record,
            ctx: meta?.ctx,
          }) === true)
      return !hiddenField && !disabled
    })
  }
  return schema
}

function repeaterChildren(value: RepeaterFieldDefinition['schema']): SchemaNodeDefinition[] {
  if (typeof value !== 'function') return value ?? []
  const children = value(schemaFactory as SchemaNamespace) as unknown as (
    SchemaNodeDefinition | SchemaNodeBuilder
  )[]
  return children.map((child) => {
    const builder = child as SchemaNodeBuilder
    return typeof builder.toDefinition === 'function'
      ? getComponentDefinition(builder)
      : (child as SchemaNodeDefinition)
  })
}

function relationshipValue(field: SelectField) {
  return vine.any().use(
    vine.createRule(async (value: unknown, _args: unknown, vineField: FieldContext) => {
      if (!field.relationship || (typeof value !== 'string' && typeof value !== 'number')) {
        vineField.report('The selected {{ field }} is invalid', 'relationship', vineField)
        return
      }
      const meta = vineField.meta as { ctx?: HttpContext; resource?: string } | undefined
      const ctx = meta?.ctx
      const owner = meta?.resource
        ? ctx?.pupitre.panel.resources.find((resource) => resource.slug === meta.resource)
        : undefined
      if (!ctx || !owner) {
        vineField.report('The selected {{ field }} is invalid', 'relationship', vineField)
        return
      }
      let model: LucidModel
      try {
        model = owner.model.$getRelation(field.relationship.name).relatedModel() as LucidModel
      } catch {
        vineField.report('The selected {{ field }} is invalid', 'relationship', vineField)
        return
      }
      const relatedResource = ctx.pupitre.panel.resources.find(
        (resource) => resource.model === model
      )
      const query = relatedResource ? scopedQuery(ctx, relatedResource) : model.query()
      field.relationship.scope?.(query, ctx)
      if (!(await query.where(model.primaryKey, value).first()))
        vineField.report('The selected {{ field }} is invalid', 'relationship', vineField)
    })()
  )
}
function closureOptionValue(field: SelectField) {
  return vine.any().use(
    vine.createRule(async (value: unknown, _args: unknown, vineField: FieldContext) => {
      if (
        (typeof value !== 'string' && typeof value !== 'number') ||
        !field.options ||
        typeof field.options !== 'function'
      ) {
        vineField.report('The selected {{ field }} is invalid', 'options', vineField)
        return
      }
      const ctx = (vineField.meta as { ctx?: HttpContext } | undefined)?.ctx
      const output = normalizeOptions(
        await field.options({ search: '', values: [value], ctx, page: 1 })
      )
      const accepted = output.some((option) => String(option) === String(value))
      if (!accepted && field.getOptionLabelUsing) {
        const label = await field.getOptionLabelUsing(value, ctx)
        if (label !== null && label !== undefined) return
      }
      if (!accepted) vineField.report('The selected {{ field }} is invalid', 'options', vineField)
    })()
  )
}
function baseSchema(field: FieldDefinitionUnion, fieldPath = field.name): any {
  const rules = field.rules ?? {}
  let schema: any
  switch (field.kind) {
    case 'text':
    case 'email':
    case 'password':
    case 'textarea':
    case 'hidden':
    case 'richEditor':
    case 'color':
      schema = vine.string()
      if (field.kind === 'email' || rules.email) schema = schema.email()
      if (rules.url) schema = schema.url()
      if (field.kind === 'richEditor') {
        schema = schema.transform((value: string) => sanitizeHtml(value))
      }
      break
    case 'number':
      schema = vine.number()
      break
    case 'checkbox':
    case 'toggle':
      schema = vine.boolean()
      break
    case 'select':
    case 'radio':
      schema =
        field.kind === 'select' && field.relationship
          ? relationshipValue(field)
          : field.kind === 'select' && typeof field.options === 'function'
            ? closureOptionValue(field)
            : stringComparableEnum(normalizeOptions(field.options))
      break
    case 'multiSelect': {
      if (field.relationship) {
        schema = vine.array(relationshipValue(field))
      } else {
        const allowed = typeof field.options === 'function' ? [] : normalizeOptions(field.options)
        const item =
          typeof field.options === 'function'
            ? closureOptionValue(field)
            : stringComparableEnum(allowed)
        schema = vine.array(item)
      }
      break
    }
    case 'checkboxList':
      schema = stringComparableEnumArray(normalizeOptions(field.options))
      break
    case 'toggleButtons': {
      const allowed = normalizeOptions(field.options)
      schema = field.multiple ? stringComparableEnumArray(allowed) : stringComparableEnum(allowed)
      break
    }
    case 'tags':
      schema = vine.array(vine.string())
      if (field.maxTags !== undefined) schema = schema.maxLength(field.maxTags)
      break
    case 'keyValue':
      schema = vine.record(vine.string())
      break
    case 'fileUpload': {
      const key = vine.string().use(
        vine.createRule((value: unknown, _args: unknown, vineField: FieldContext) => {
          if (!isUploadedFileKey(value, fieldPath, vineField)) {
            vineField.report(
              'The {{ field }} field contains a file not uploaded for this field',
              'fileUpload',
              vineField
            )
          }
        })()
      )
      schema = field.multiple ? vine.array(key) : key
      if (field.multiple && field.maxFiles !== undefined) schema = schema.maxLength(field.maxFiles)
      break
    }
    case 'date':
    case 'dateTime':
      schema = vine
        .string()
        .use(
          vine.createRule((value: unknown, _args: unknown, vineField: FieldContext) => {
            if (typeof value !== 'string') return
            const timezone =
              (vineField.meta as { timezone?: string } | undefined)?.timezone ??
              field.timezone ??
              'UTC'
            if (!parseInZone(value, timezone))
              vineField.report('The {{ field }} field must be a valid date', 'date', vineField)
          })()
        )
        .transform((value: string | null) =>
          value === null ? null : DateTime.fromISO(value, { zone: 'UTC' })
        )
      break
    case 'time':
      schema = vine.string().use(
        vine.createRule((value: unknown, _args: unknown, vineField: FieldContext) => {
          if (typeof value === 'string' && !timeIsValid(value)) {
            vineField.report('The {{ field }} field must be a valid time', 'time', vineField)
          }
        })()
      )
      break
    case 'repeater':
      schema = vine.array(
        vine.object(schemaProperties(repeaterChildren(field.schema), fieldPath) as never)
      )
      if (field.minItems !== undefined) schema = schema.minLength(field.minItems)
      if (field.maxItems !== undefined) schema = schema.maxLength(field.maxItems)
      schema = addRules(schema, field)
      schema = applyPresence(schema, field)
      return schema
    default:
      schema = vine.any()
  }
  schema = addRules(schema, field)
  schema = applyPresence(schema, field)
  return schema
}

type NestedProperty = { __nested: true; properties: ObjectProperties }
type ObjectProperties = Record<string, unknown>
function insertProperty(properties: ObjectProperties, path: string, schema: unknown): void {
  const [head, ...rest] = path.split('.')
  if (rest.length === 0) {
    properties[head] = schema
    return
  }
  let nested = properties[head] as NestedProperty | undefined
  if (!nested || nested.__nested !== true) {
    nested = { __nested: true, properties: {} }
    properties[head] = nested
  }
  insertProperty(nested.properties, rest.join('.'), schema)
}

function vineObjectProperties(properties: ObjectProperties): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (value && typeof value === 'object' && '__nested' in value && value.__nested === true) {
      const nested = value as NestedProperty
      result[key] = vine.object(vineObjectProperties(nested.properties) as never)
    } else {
      result[key] = value
    }
  }
  return result
}

const fieldKinds: Record<string, true> = {
  text: true,
  email: true,
  password: true,
  number: true,
  textarea: true,
  hidden: true,
  select: true,
  multiSelect: true,
  checkbox: true,
  checkboxList: true,
  radio: true,
  toggle: true,
  toggleButtons: true,
  date: true,
  dateTime: true,
  time: true,
  color: true,
  tags: true,
  keyValue: true,
  richEditor: true,
  fileUpload: true,
  repeater: true,
}

function schemaProperties(nodes: SchemaNodeDefinition[], pathPrefix = ''): Record<string, unknown> {
  const properties: ObjectProperties = {}
  for (const node of nodes) {
    if ('children' in node) {
      Object.assign(properties, schemaProperties(node.children, pathPrefix))
    } else if (node.kind in fieldKinds && 'name' in node) {
      const field = node as FieldDefinitionUnion
      const fieldPath = pathPrefix ? `${pathPrefix}.${field.name}` : field.name
      insertProperty(properties, field.name, baseSchema(field, fieldPath))
    }
  }
  return vineObjectProperties(properties)
}

function collectFields(
  nodes: SchemaNodeDefinition[],
  prefix = '',
  repeatPath?: string,
  result: FieldRecord[] = []
): FieldRecord[] {
  for (const node of nodes) {
    if ('children' in node) {
      collectFields(node.children, prefix, repeatPath, result)
    } else if (node.kind in fieldKinds && 'name' in node) {
      const field = node as FieldDefinitionUnion
      const path = prefix ? `${prefix}.${field.name}` : field.name
      result.push({ field, path, repeatPath })
      if (field.kind === 'repeater')
        collectFields(repeaterChildren(field.schema), path, path, result)
    }
  }
  return result
}

function getAt(data: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, data)
}
function setAt(data: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let cursor: unknown = data
  for (const [index, segment] of parts.slice(0, -1).entries()) {
    const nextIsIndex = /^\d+$/.test(parts[index + 1])
    if (Array.isArray(cursor)) {
      const itemIndex = Number(segment)
      if (!cursor[itemIndex] || typeof cursor[itemIndex] !== 'object') {
        cursor[itemIndex] = nextIsIndex ? [] : {}
      }
      cursor = cursor[itemIndex]
    } else if (cursor && typeof cursor === 'object') {
      const object = cursor as Record<string, unknown>
      if (!object[segment] || typeof object[segment] !== 'object') {
        object[segment] = nextIsIndex ? [] : {}
      }
      cursor = object[segment]
    }
  }
  const last = parts.at(-1)!
  if (Array.isArray(cursor)) cursor[Number(last)] = value
  else if (cursor && typeof cursor === 'object') (cursor as Record<string, unknown>)[last] = value
}
function deleteAt(data: Record<string, unknown>, path: string): void {
  const parts = path.split('.')
  if (parts.length === 1) {
    delete data[parts[0]]
    return
  }
  const parent = getAt(data, parts.slice(0, -1).join('.')) as Record<string, unknown> | undefined
  if (parent && typeof parent === 'object') delete parent[parts.at(-1)!]
}
type DataContext = { value: unknown; path: string }
type ConcreteField = { path: string; local: unknown }

function repeatContexts(data: unknown, path: string): DataContext[] {
  let contexts: DataContext[] = [{ value: data, path: '' }]
  for (const segment of path.split('.')) {
    const next: DataContext[] = []
    for (const context of contexts) {
      if (context.value === null || typeof context.value !== 'object') continue
      const value = (context.value as Record<string, unknown>)[segment]
      const fieldPath = context.path ? `${context.path}.${segment}` : segment
      if (Array.isArray(value)) {
        value.forEach((item, index) => next.push({ value: item, path: `${fieldPath}.${index}` }))
      } else if (value !== undefined) {
        next.push({ value, path: fieldPath })
      }
    }
    contexts = next
  }
  return contexts
}

function concreteFields(data: unknown, item: FieldRecord): ConcreteField[] {
  if (!item.repeatPath) return [{ path: item.path, local: data }]
  return repeatContexts(data, item.repeatPath).map((context) => ({
    path: `${context.path}.${item.field.name}`,
    local: context.value,
  }))
}

function prepareDates(
  data: Record<string, unknown>,
  fields: FieldRecord[],
  timezone: string
): void {
  for (const item of fields) {
    const { field } = item
    if (field.kind !== 'date' && field.kind !== 'dateTime') continue
    for (const concrete of concreteFields(data, item)) {
      const value = getAt(data, concrete.path)
      if (typeof value !== 'string') continue
      // Calendar dates carry no instant: parse them as UTC midnight, never shifted.
      const zone = field.kind === 'date' ? 'UTC' : (field.timezone ?? timezone)
      const parsed = parseInZone(value, zone)
      if (parsed) setAt(data, concrete.path, parsed.toUTC().toISO())
    }
  }
}

function hidden(
  field: FieldDefinitionUnion,
  data: unknown,
  local?: unknown,
  record?: Record<string, unknown> | null,
  ctx?: HttpContext
): boolean {
  const get = (path: string) => getAt(local, path) ?? getAt(data, path)
  const args = { get, record: record ?? null, ctx }
  return (
    (typeof field.hidden === 'function' && field.hidden(args) === true) ||
    (typeof field.visible === 'function' && field.visible(args) === false)
  )
}
function filterHidden(
  data: Record<string, unknown>,
  fields: FieldRecord[],
  options: ValidatorOptions
): Record<string, unknown> {
  const filtered = structuredClone(data)
  const record = options.record?.serialize() ?? null
  for (const item of fields) {
    for (const concrete of concreteFields(data, item)) {
      const args = {
        get: (path: string) => getAt(concrete.local, path) ?? getAt(data, path),
        record,
        ctx: options.ctx,
      }
      const disabled =
        item.field.disabled === true ||
        (typeof item.field.disabled === 'function' && item.field.disabled(args) === true)
      if (item.field.dehydrated === false || (disabled && item.field.dehydrated !== true)) {
        deleteAt(filtered, concrete.path)
        continue
      }
      if (
        item.field.dehydratedWhenHidden === false &&
        hidden(item.field, data, concrete.local, record, options.ctx)
      ) {
        deleteAt(filtered, concrete.path)
      }
    }
  }
  return filtered
}

function buildValidator(nodes: SchemaNodeDefinition[], fields: FieldRecord[]): FormValidator {
  const compiled = vine.compile(vine.object(schemaProperties(nodes) as never))
  return {
    async validate(data, options) {
      const input =
        data && typeof data === 'object' && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : {}
      const filtered = filterHidden(input, fields, options)
      prepareDates(filtered, fields, options.timezone)
      const validated = await compiled.validate(filtered, {
        meta: {
          record: options.record ?? null,
          model: options.model ?? null,
          ctx: options.ctx,
          timezone: options.timezone,
          resource: resourceSlug(nodes, options.ctx),
        },
      })
      for (const item of fields) {
        for (const concrete of concreteFields(validated, item)) {
          const value = getAt(validated, concrete.path)
          if (value === undefined || item.field.dehydrated === false) {
            deleteAt(validated, concrete.path)
            continue
          }
          if (typeof item.field.dehydrate === 'function') {
            setAt(validated, concrete.path, item.field.dehydrate(value))
          }
        }
      }
      return validated as Record<string, unknown>
    },
  }
}

export function compileValidator(nodes: SchemaNodeDefinition[]): FormValidator {
  const cached = validators.get(nodes)
  if (cached) return cached
  const validator = buildValidator(nodes, collectFields(nodes))
  validators.set(nodes, validator)
  return validator
}
