import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import type { Database } from '@adonisjs/lucid/database'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { FieldContext } from '@vinejs/vine/types'
import { DateTime } from 'luxon'
import type {
  FieldDefinitionUnion,
  SchemaNodeDefinition,
  ValidationRules,
} from '../definition/schema.js'
import { parseInZone } from '../format/index.js'
import { sanitizeHtml } from '../sanitize.js'

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
const singleValidators = new WeakMap<FieldDefinitionUnion, FormValidator>()

function normalizeOptions(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return Object.keys(value)
  return []
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
      // Field names are model attributes (camelCase); the query needs DB columns.
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
  if (field.dehydrated === false || !rules.required) return schema.optional()
  if (field.dehydratedWhenHidden === false) {
    return schema.optional().requiredWhen((vineField: FieldContext) => {
      const meta = vineField.meta as
        { record?: Record<string, unknown> | null; ctx?: HttpContext } | undefined
      return !hidden(field, vineField.data, vineField.data, meta?.record, meta?.ctx)
    })
  }
  return schema
}

function baseSchema(field: FieldDefinitionUnion): any {
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
      schema = vine.enum(normalizeOptions(field.options) as [any, ...any[]])
      break
    case 'multiSelect':
    case 'checkboxList':
    case 'toggleButtons': {
      if (field.kind === 'toggleButtons' && !field.multiple) {
        schema = vine.enum(normalizeOptions(field.options) as [any, ...any[]])
      } else {
        const allowed = normalizeOptions(field.options)
        const item = allowed.length ? vine.enum(allowed as [any, ...any[]]) : vine.any()
        schema = vine.array(item)
      }
      break
    }
    case 'tags':
      schema = vine.array(vine.string())
      if (field.maxTags !== undefined) schema = schema.maxLength(field.maxTags)
      break
    case 'keyValue':
      schema = vine.record(vine.string())
      break
    case 'fileUpload':
      schema = field.multiple ? vine.array(vine.string()) : vine.string()
      if (field.multiple && field.maxFiles !== undefined) schema = schema.maxLength(field.maxFiles)
      break
    case 'date':
    case 'dateTime':
    case 'time':
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
        .transform((value: string) => DateTime.fromISO(value, { zone: 'UTC' }))
      break
    case 'repeater':
      schema = vine.array(
        vine.object(schemaProperties(Array.isArray(field.schema) ? field.schema : []) as never)
      )
      if (field.minItems !== undefined) schema = schema.minLength(field.minItems)
      if (field.maxItems !== undefined) schema = schema.maxLength(field.maxItems)
      schema = addRules(schema, field)
      schema = applyPresence(schema, field)
      if (rules.nullable) schema = schema.nullable()
      return schema
    default:
      schema = vine.any()
  }
  schema = addRules(schema, field)
  schema = applyPresence(schema, field)
  if (rules.nullable) schema = schema.nullable()
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

function schemaProperties(nodes: SchemaNodeDefinition[]): Record<string, unknown> {
  const properties: ObjectProperties = {}
  for (const node of nodes) {
    if ('children' in node) {
      Object.assign(properties, schemaProperties(node.children))
    } else if (node.kind in fieldKinds && 'name' in node) {
      const field = node as FieldDefinitionUnion
      insertProperty(properties, field.name, baseSchema(field))
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
      if (field.kind === 'repeater' && Array.isArray(field.schema))
        collectFields(field.schema, path, path, result)
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
    if (field.kind !== 'date' && field.kind !== 'dateTime' && field.kind !== 'time') continue
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
      if (item.field.dehydrated === false) {
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

export function compileFieldValidator(node: FieldDefinitionUnion): FormValidator {
  const cached = singleValidators.get(node)
  if (cached) return cached
  const validator = buildValidator([node], collectFields([node]))
  singleValidators.set(node, validator)
  return validator
}
