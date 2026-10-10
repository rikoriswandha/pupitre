import { validateSpec } from '@json-render/core'
import type { HttpContext } from '@adonisjs/core/http'
import {
  catalogVersion,
  jsonRenderSpec,
  pupitreCatalog,
  type JsonRenderSpec,
  type FormDescriptor,
} from '../../catalog/index.js'
import type { StateModel, Option, RepeaterDescriptor } from '../../catalog/index.js'
import type {
  SchemaNodeDefinition,
  FieldDefinitionUnion,
  RepeaterFieldDefinition,
  SchemaNamespace,
} from '../definition/schema.js'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import {
  toIsoInZone,
  formatDate,
  formatDateTime,
  formatSince,
  formatMoney,
  formatNumber,
  truncate,
} from '../format/index.js'
import { sanitizeHtml } from '../sanitize.js'
import { evaluateClosure, liftClosure } from './closure_lifter.js'
import { type SpecCache, type StaticSlot } from './cache.js'
import { E_PUPITRE_INVALID_SPEC, E_PUPITRE_UNLIFTABLE_CLOSURE } from '../errors.js'
import { schema as schemaFactory } from '../builder/schema/schema.js'

type Element = {
  type: string
  props: Record<string, unknown>
  children?: string[]
  slots?: Record<string, string[]>
  visible?: unknown
  repeat?: unknown
  watch?: Record<string, unknown[]>
  on?: Record<string, unknown[]>
}
export type CompileContext = {
  locale: string
  timezone: string
  ctx?: HttpContext
  record?: Record<string, unknown> | null
  model?: LucidRow | null
  uploadUrls?: { upload: string; delete: string }
  resolveFileUrl?: (key: string, field: FieldDefinitionUnion) => Promise<string | null>
  cache?: { key: string; store: SpecCache } | null
}
export type CompiledSchema = { spec: JsonRenderSpec; state: StateModel; catalogVersion: string }
type BuildContext = {
  elements: Record<string, Element>
  state: Record<string, unknown>
  slots: StaticSlot[]
  layoutId: number
  tabState: Record<string, string>
  options: CompileContext
  data: Record<string, unknown>
}
function repeaterChildren(value: RepeaterFieldDefinition['schema']): SchemaNodeDefinition[] {
  return typeof value === 'function' ? value(schemaFactory as SchemaNamespace) : (value ?? [])
}
const fieldType: Record<string, string> = {
  text: 'Text',
  email: 'Text',
  password: 'Text',
  number: 'Number',
  textarea: 'Textarea',
  hidden: 'Hidden',
  select: 'Select',
  multiSelect: 'Select',
  checkbox: 'Checkbox',
  checkboxList: 'CheckboxList',
  radio: 'Radio',
  toggle: 'Toggle',
  toggleButtons: 'ToggleButtons',
  date: 'Date',
  dateTime: 'DateTime',
  time: 'Time',
  color: 'Color',
  tags: 'Tags',
  keyValue: 'KeyValue',
  richEditor: 'RichEditor',
  fileUpload: 'FileUpload',
  repeater: 'Repeater',
}
const infolistType: Record<string, string> = {
  textEntry: 'TextEntry',
  iconEntry: 'IconEntry',
  imageEntry: 'ImageEntry',
  colorEntry: 'ColorEntry',
  keyValueEntry: 'KeyValueEntry',
  repeatableEntry: 'RepeatableEntry',
  codeEntry: 'CodeEntry',
  badgeEntry: 'BadgeEntry',
}
const fieldKinds: Record<string, true> = Object.fromEntries(
  Object.keys(fieldType).map((kind) => [kind, true])
)
function headline(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}
function pointer(path: string) {
  return path.split('.').filter(Boolean).join('/')
}
function getPath(data: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined,
      data
    )
}
function setPath(data: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let target = data
  for (const part of parts.slice(0, -1)) target = (target[part] ??= {}) as Record<string, unknown>
  const key = parts.at(-1)
  if (key) target[key] = value
}
function setStatePath(data: Record<string, unknown>, path: string, value: unknown): void {
  setPath(data, path.slice(1).replaceAll('/', '.'), value)
}
function parseFileSize(value: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i.exec(value)
  if (!match) return undefined
  const unit = match[2]!.toLowerCase()
  const multiplier =
    unit === 'gb' ? 1_073_741_824 : unit === 'mb' ? 1_048_576 : unit === 'kb' ? 1_024 : 1
  return Number(match[1]) * multiplier
}
function defaults(
  nodes: SchemaNodeDefinition[],
  data: Record<string, unknown>,
  create: boolean
): void {
  for (const node of nodes) {
    if ('name' in node && node.name) {
      const value = getPath(data, node.name)
      if (node.kind === 'repeater') {
        const definition = node as FieldDefinitionUnion & {
          schema?: SchemaNodeDefinition[] | ((arg: unknown) => SchemaNodeDefinition[])
          defaultItems?: number
        }
        const template = repeaterChildren(definition.schema)
        const rows = Array.isArray(value)
          ? value
          : create
            ? Array.from({ length: definition.defaultItems ?? 0 }, () => ({}))
            : []
        const keyed = rows.map((row, index) => ({
          ...(row as Record<string, unknown>),
          _key: (row as Record<string, unknown>)._key ?? `k${index}`,
        }))
        if (value === undefined || create) setPath(data, node.name, keyed)
        for (const row of keyed) defaults(template, row, create)
      } else if (value === undefined && create && 'default' in node && node.default !== undefined)
        setPath(
          data,
          node.name,
          typeof node.default === 'function' ? (node.default as () => unknown)() : node.default
        )
    }
    if ('children' in node && Array.isArray(node.children)) defaults(node.children, data, create)
  }
}
function optionsFor(value: unknown): Option[] | undefined {
  if (Array.isArray(value))
    return value.map((option) =>
      typeof option === 'object' && option !== null && 'value' in option
        ? (option as Option)
        : { value: String(option), label: String(option) }
    )
  if (value && typeof value === 'object')
    return Object.entries(value).map(([optionValue, label]) => ({
      value: optionValue,
      label: typeof label === 'string' ? label : String(label),
    }))
  return undefined
}
function addStatic(
  build: BuildContext,
  id: string,
  prop: string,
  closure: Function,
  options: { sanitize?: boolean; invert?: boolean } = {}
): void {
  build.slots.push({
    elementId: id,
    prop,
    evaluate: (data, record, ctx) => {
      const value = evaluateClosure(closure, data, record, ctx)
      const output = options.invert ? !value : value
      return options.sanitize && typeof output === 'string' ? sanitizeHtml(output) : output
    },
  })
}

function applyVisibility(
  node: Record<string, unknown>,
  id: string,
  build: BuildContext,
  inRepeater = false
): void {
  const hidden = typeof node.hidden === 'function'
  const closure = hidden ? node.hidden : node.visible
  if (typeof closure !== 'function') return
  const result = liftClosure(closure, 'visible', { pathPrefix: '/data', inRepeater })
  if (result.kind === 'static') addStatic(build, id, '@visible', closure, { invert: hidden })
  else
    build.elements[id].visible = hidden
      ? { ...(result.value as Record<string, unknown>), not: true }
      : result.value
}
function mapOptions(node: Record<string, unknown>, props: Record<string, unknown>) {
  if ('options' in node) props.options = optionsFor(node.options)
}
async function addField(
  node: FieldDefinitionUnion,
  build: BuildContext,
  parentPath = '',
  inRepeater = false
): Promise<string> {
  const path = parentPath ? `${parentPath}.${node.name}` : node.name
  const id = `f.${path}`
  if (node.kind === 'repeater') {
    const definition = node as FieldDefinitionUnion & {
      schema?: SchemaNodeDefinition[] | ((arg: unknown) => SchemaNodeDefinition[])
      minItems?: number
      maxItems?: number
      reorderable?: boolean
      collapsible?: boolean
      collapsed?: boolean
      cloneable?: boolean
      addLabel?: string
      itemLabel?: unknown
      defaultItems?: number
      grid?: number | Record<string, number>
    }
    const children = repeaterChildren(definition.schema)
    const templateId = `${id}.item`
    const templateChildren: string[] = []
    for (const child of children) templateChildren.push(await addNode(child, build, path, true))
    const on: Record<string, unknown[]> = {
      remove: [
        {
          action: 'removeState',
          params: {
            statePath: inRepeater ? { $item: node.name } : `/data/${pointer(path)}`,
            index: { $index: true },
          },
        },
      ],
      move: [
        {
          action: 'setState',
          params: {
            statePath: inRepeater ? { $item: node.name } : `/data/${pointer(path)}`,
            value: inRepeater ? { $item: node.name } : { $state: `/data/${pointer(path)}` },
          },
        },
      ],
      clone: [
        {
          action: 'pushState',
          params: {
            statePath: inRepeater ? { $item: node.name } : `/data/${pointer(path)}`,
            value: { $item: '', _key: '$id' },
          },
        },
      ],
      collapse: [
        {
          action: 'setState',
          params: {
            statePath: `/ui/repeater/${pointer(path)}/collapsed`,
            value: {
              $cond: { $state: `/ui/repeater/${pointer(path)}/collapsed` },
              $then: false,
              $else: true,
            },
          },
        },
      ],
    }
    const itemDefaults = Array.isArray(getPath(build.data, path))
      ? (getPath(build.data, path) as Record<string, unknown>[])
      : []
    const defaultItem: Record<string, unknown> = {}
    defaults(children, defaultItem, true)
    const liftedLabel =
      typeof definition.itemLabel === 'function'
        ? liftClosure(definition.itemLabel, 'label', {
            pathPrefix: `/data/${pointer(path)}`,
            inRepeater: true,
          })
        : undefined
    const descriptor = {
      name: path,
      minItems: definition.minItems,
      maxItems: definition.maxItems,
      reorderable: definition.reorderable ?? false,
      collapsible: definition.collapsible ?? false,
      collapsed: definition.collapsed,
      cloneable: definition.cloneable ?? false,
      addLabel: definition.addLabel,
      grid: definition.grid,
      itemLabel:
        liftedLabel && liftedLabel.kind !== 'static' ? liftedLabel.value : definition.itemLabel,
      defaultItems: itemDefaults,
    } as unknown as RepeaterDescriptor
    build.elements[templateId] = {
      type: 'RepeaterItem',
      props: { index: { $index: true } },
      children: templateChildren,
      on,
    }
    const statePath = inRepeater ? { $item: node.name } : `/data/${pointer(path)}`
    const repeatValue = inRepeater ? { $bindItem: node.name } : { $bindState: statePath }
    const repeater: Element = {
      type: 'Repeater',
      props: { descriptor, value: repeatValue },
      children: [templateId],
      repeat: { statePath, key: '_key' },
      on: {
        add: [
          { action: 'pushState', params: { statePath, value: { ...defaultItem, _key: '$id' } } },
        ],
      },
    }
    build.elements[id] = repeater
    return id
  }
  const type = fieldType[node.kind]
  const props: Record<string, unknown> = {
    name: path,
    label: typeof node.label === 'string' || node.label === null ? node.label : headline(node.name),
    value: inRepeater ? { $bindItem: node.name } : { $bindState: `/data/${pointer(path)}` },
  }
  if (!inRepeater) props.error = { $state: `/errors/${pointer(path)}` }
  if (node.helperText !== undefined) props.helperText = node.helperText
  if (node.hint !== undefined) props.hint = node.hint
  if (node.placeholder !== undefined && typeof node.placeholder !== 'function')
    props.placeholder = node.placeholder
  if (node.rules?.required) props.required = true
  if (node.rules?.maxLength !== undefined) props.maxLength = node.rules.maxLength
  if (node.rules?.min !== undefined) props.min = node.rules.min
  if (node.rules?.max !== undefined) props.max = node.rules.max
  if (node.rules?.step !== undefined) props.step = node.rules.step
  if (node.disabled !== undefined && typeof node.disabled !== 'function')
    props.disabled = node.disabled
  if (node.readOnly !== undefined) props.readOnly = node.readOnly
  if (node.columnSpan !== undefined) props.columnSpan = node.columnSpan
  if (node.extraAttributes !== undefined) props.extraAttributes = node.extraAttributes
  const excluded = new Set([
    'kind',
    'name',
    'label',
    'helperText',
    'hint',
    'placeholder',
    'default',
    'disabled',
    'readOnly',
    'visible',
    'hidden',
    'columnSpan',
    'extraAttributes',
    'live',
    'afterStateUpdated',
    'dehydrated',
    'dehydratedWhenHidden',
    'format',
    'dehydrate',
    'rules',
    'schema',
    'maxSize',
    'image',
    'maxFiles',
    'accept',
    'disk',
    'directory',
    'visibility',
    'reorderable',
    'downloadable',
    'previewable',
  ])
  for (const [key, value] of Object.entries(node))
    if (!excluded.has(key) && value !== undefined) props[key] = value
  if (node.kind === 'email' || node.kind === 'password') props.type = node.kind
  if (node.kind === 'multiSelect') props.multiple = true
  if ('minDate' in node && node.minDate !== undefined) props.min = node.minDate
  if ('maxDate' in node && node.maxDate !== undefined) props.max = node.maxDate
  mapOptions(node as unknown as Record<string, unknown>, props)
  if (node.kind === 'fileUpload') {
    const maxSize =
      typeof node.maxSize === 'number'
        ? node.maxSize
        : typeof node.maxSize === 'string'
          ? parseFileSize(node.maxSize)
          : undefined
    props.descriptor = {
      name: path,
      uploadUrl: build.options.uploadUrls?.upload ?? '',
      deleteUrl: build.options.uploadUrls?.delete ?? '',
      multiple: node.multiple ?? false,
      accept: typeof node.accept === 'string' ? [node.accept] : node.accept,
      maxSize,
      maxFiles: node.maxFiles,
      image: node.image ?? false,
      directory: node.directory,
      visibility: node.visibility,
      reorderable: node.reorderable ?? false,
      downloadable: node.downloadable ?? false,
      previewable: node.previewable ?? true,
    }
  }
  if (node.live) props.live = node.live === true ? true : node.live
  build.elements[id] = { type, props }
  for (const prop of ['label', 'disabled', 'placeholder'] as const) {
    const closure = node[prop]
    if (typeof closure !== 'function') continue
    const lifted = liftClosure(closure, prop === 'placeholder' ? 'content' : prop, {
      pathPrefix: '/data',
      inRepeater,
    })
    if (lifted.kind === 'static') addStatic(build, id, prop, closure)
    else props[prop] = lifted.value
  }
  applyVisibility(node as unknown as Record<string, unknown>, id, build, inRepeater)
  if (typeof node.afterStateUpdated === 'function') {
    const lifted = liftClosure(node.afterStateUpdated, 'afterStateUpdated', {
      pathPrefix: '/data',
      inRepeater,
    })
    if (lifted.kind === 'static') {
      const error = new E_PUPITRE_UNLIFTABLE_CLOSURE()
      error.message = `Cannot lift afterStateUpdated for field "${path}"`
      throw error
    }
    build.elements[id].watch = { [`/data/${pointer(path)}`]: lifted.value as unknown[] }
  }
  return id
}
async function addNode(
  node: SchemaNodeDefinition,
  build: BuildContext,
  parentPath = '',
  inRepeater = false
): Promise<string> {
  if (fieldKinds[node.kind])
    return addField(node as FieldDefinitionUnion, build, parentPath, inRepeater)
  if (node.kind.endsWith('Entry')) return addEntry(node, build)
  const id = `l.${build.layoutId++}`
  const element = node as unknown as Record<string, unknown>
  const children = 'children' in node ? node.children : []
  const childIds: string[] = []
  if (node.kind === 'tabs') {
    const tabNodes = children as SchemaNodeDefinition[]
    const tabs = tabNodes.filter((child) => child.kind === 'tab')
    const tabSpecs: { key: string; label: string }[] = []
    for (const tab of tabs) {
      const tabNode = tab as unknown as Record<string, unknown>
      const key = String(tabNode.name)
      const tabId = `l.${build.layoutId++}`
      const ids: string[] = []
      for (const child of (tab as Extract<SchemaNodeDefinition, { kind: 'tab' }>).children)
        ids.push(await addNode(child, build, parentPath, inRepeater))
      build.elements[tabId] = { type: 'Tab', props: { key, label: headline(key) }, children: ids }
      childIds.push(tabId)
      tabSpecs.push({ key, label: headline(key) })
    }
    const tabsId = id
    const activePath = `/ui/tabs/${tabsId}`
    build.tabState[tabsId] = tabSpecs[0]?.key ?? ''
    build.elements[id] = {
      type: 'Tabs',
      props: { id: tabsId, tabs: tabSpecs, active: { $bindState: activePath } },
      children: childIds,
    }
  } else {
    for (const child of children as SchemaNodeDefinition[])
      childIds.push(await addNode(child, build, parentPath, inRepeater))
    const type =
      node.kind === 'fragment' ? 'Fragment' : node.kind[0].toUpperCase() + node.kind.slice(1)
    const props: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(element))
      if (
        !['kind', 'children', 'visible', 'hidden'].includes(key) &&
        value !== undefined &&
        typeof value !== 'function'
      )
        props[key] = value
    if (node.kind === 'split' && !('from' in props)) props.from = 'md'
    if (node.kind === 'section' && typeof node.aside === 'boolean') {
      if (node.aside) props.aside = 'Aside'
      else delete props.aside
    }
    if (node.kind === 'section' && node.collapsible) {
      const path = `/ui/section/${id}/collapsed`
      props.collapsed = { $bindState: path }
      setStatePath(build.state, path, node.collapsed ?? false)
    }
    if (node.kind === 'placeholder' || node.kind === 'html') {
      const closure = node.content
      if (typeof closure === 'function') {
        const lifted = liftClosure(closure, 'content', { pathPrefix: '/data', inRepeater })
        if (lifted.kind === 'static')
          addStatic(build, id, 'content', closure, { sanitize: node.kind === 'html' })
        else props.content = lifted.value
      } else if (node.kind === 'html' && typeof props.content === 'string')
        props.content = sanitizeHtml(props.content)
    }
    build.elements[id] = { type, props, children: childIds }
  }
  applyVisibility(element, id, build, inRepeater)
  return id
}
async function addEntry(node: SchemaNodeDefinition, build: BuildContext): Promise<string> {
  const entry = node as unknown as Record<string, unknown>
  const path = String(entry.name ?? '')
  const id = `f.${path}`
  const value = getPath(build.options.record ?? {}, path)
  const props: Record<string, unknown> = {
    label: typeof entry.label === 'string' || entry.label === null ? entry.label : headline(path),
    value: await formatEntryValue(entry, value, build.options),
  }
  for (const [key, prop] of Object.entries(entry))
    if (
      !['kind', 'name', 'label', 'value', 'url', 'schema'].includes(key) &&
      prop !== undefined &&
      typeof prop !== 'function'
    )
      props[key] = prop
  if (typeof entry.url === 'function') addStatic(build, id, 'url', entry.url as Function)
  if (entry.kind === 'badgeEntry' && entry.colors && typeof entry.colors === 'object')
    props.color = (entry.colors as Record<string, unknown>)[String(value)]
  build.elements[id] = { type: infolistType[String(entry.kind)], props }
  return id
}
async function formatEntryValue(
  entry: Record<string, unknown>,
  value: unknown,
  options: CompileContext
): Promise<unknown> {
  if (value === null || value === undefined) return value
  const context = { locale: options.locale, timezone: options.timezone }
  if (entry.dateTime) return formatDateTime(value as string, context, String(entry.dateTime))
  if (entry.date) return formatDate(value as string, context, String(entry.date))
  if (entry.since) return formatSince(value as string, context)
  if (entry.money)
    return formatMoney(value as number | string, context, { currency: String(entry.money) })
  if (entry.limit) return truncate(value, Number(entry.limit))
  if (entry.html && typeof value === 'string') return sanitizeHtml(value)
  if (entry.kind === 'imageEntry' && typeof value === 'string' && options.resolveFileUrl)
    return options.resolveFileUrl(value, {
      kind: 'fileUpload',
      name: String(entry.name),
    } as FieldDefinitionUnion)
  if (entry.kind === 'repeatableEntry' && Array.isArray(value)) {
    const entries = Array.isArray(entry.schema) ? (entry.schema as Record<string, unknown>[]) : []
    return Promise.all(
      value.map(async (row) => {
        const record = row as Record<string, unknown>
        return Object.fromEntries(
          await Promise.all(
            entries.map(
              async (child) =>
                [
                  String(child.name),
                  await formatEntryValue(child, getPath(record, String(child.name)), options),
                ] as const
            )
          )
        )
      })
    )
  }
  if (entry.kind === 'keyValueEntry' && typeof value === 'object') return value
  if (entry.kind === 'codeEntry' && typeof value !== 'string') return JSON.stringify(value, null, 2)
  if (typeof value === 'number' && entry.numeric)
    return formatNumber(value, { locale: options.locale })
  return value
}

function normalizeFormData(
  nodes: SchemaNodeDefinition[],
  data: Record<string, unknown>,
  timezone: string,
  record: Record<string, unknown> | null
): void {
  for (const node of nodes) {
    if (node.kind === 'repeater') {
      const rows = getPath(data, node.name)
      const children = repeaterChildren(node.schema)
      if (Array.isArray(rows))
        for (const row of rows)
          normalizeFormData(children, row as Record<string, unknown>, timezone, record)
      continue
    }
    if (!fieldKinds[node.kind] || !('name' in node)) continue
    const field = node as FieldDefinitionUnion
    if (typeof field.format === 'function' && record)
      setPath(data, field.name, field.format(record))
    const value = getPath(data, field.name)
    if (field.kind === 'dateTime' && value !== null && value !== undefined)
      setPath(data, field.name, toIsoInZone(value as string, field.timezone ?? timezone))
    if (field.kind === 'richEditor' && typeof value === 'string')
      setPath(data, field.name, sanitizeHtml(value))
  }
}
async function compile(
  nodes: SchemaNodeDefinition[],
  options: CompileContext,
  rootType: 'Infolist' | 'Form',
  form?: FormDescriptor,
  dataInput?: Record<string, unknown>
): Promise<CompiledSchema> {
  const data = structuredClone(dataInput ?? options.record ?? {})
  defaults(nodes, data, rootType === 'Form' && !options.record)
  if (rootType === 'Form') normalizeFormData(nodes, data, options.timezone, options.record ?? null)
  const cacheOption = options.cache
  const cached = cacheOption?.store.get(cacheOption.key) as
    { spec: JsonRenderSpec; slots: StaticSlot[] } | undefined
  if (cached) {
    const previousState = (cached.spec.state ?? {}) as StateModel
    const state: StateModel = {
      ...previousState,
      data,
      errors: {},
      meta: { record: options.record ?? null, dirty: false, submitting: false },
    }
    const spec = structuredClone({ ...cached.spec, state })
    for (const slot of cached.slots) {
      const value = await slot.evaluate(data, options.record ?? null, options.ctx)
      if (slot.prop === '@visible') spec.elements[slot.elementId]!.visible = value as never
      else spec.elements[slot.elementId]!.props[slot.prop] = value
    }
    validateOutput(spec)
    return { spec, state, catalogVersion }
  }
  const build: BuildContext = {
    elements: {},
    state: {},
    slots: [],
    layoutId: 0,
    tabState: {},
    options,
    data,
  }
  const children: string[] = []
  for (const node of nodes) children.push(await addNode(node, build))
  build.elements.root = { type: rootType, props: rootType === 'Form' ? { ...form } : {}, children }
  const ui =
    build.state.ui && typeof build.state.ui === 'object'
      ? (build.state.ui as Record<string, unknown>)
      : {}
  const state: StateModel = {
    data,
    errors: {},
    meta: { record: options.record ?? null, dirty: false, submitting: false },
    ui: { tabs: build.tabState, ...ui },
  }
  const baseSpec = { root: 'root', elements: build.elements, state } as JsonRenderSpec
  if (cacheOption)
    cacheOption.store.set(cacheOption.key, { spec: structuredClone(baseSpec), slots: build.slots })
  const spec = structuredClone(baseSpec)
  for (const slot of build.slots) {
    const value = await slot.evaluate(data, options.record ?? null, options.ctx)
    if (slot.prop === '@visible') spec.elements[slot.elementId]!.visible = value as never
    else spec.elements[slot.elementId]!.props[slot.prop] = value
  }
  validateOutput(spec)
  return { spec, state, catalogVersion }
}
function validateOutput(spec: JsonRenderSpec): void {
  if (process.env.NODE_ENV === 'production') return
  const catalogResult = jsonRenderSpec.safeParse(spec)
  const issues = validateSpec(spec as never)
  const componentIssues = Object.entries(spec.elements).flatMap(([id, element]) => {
    const definition =
      pupitreCatalog.components[element.type as keyof typeof pupitreCatalog.components]
    if (!definition) return []
    const result = definition.props.safeParse(element.props)
    return result.success ? [] : [{ id, issues: result.error.issues }]
  })
  if (!catalogResult.success || !issues.valid || componentIssues.length) {
    const details = [
      !catalogResult.success ? JSON.stringify(catalogResult.error.issues, null, 2) : '',
      !issues.valid ? JSON.stringify(issues.issues, null, 2) : '',
      componentIssues.length ? JSON.stringify(componentIssues, null, 2) : '',
    ]
      .filter(Boolean)
      .join('\n')
    const error = new E_PUPITRE_INVALID_SPEC()
    error.message = `Invalid compiled Pupitre spec:\n${details}`
    throw error
  }
}
export function compileForm(
  nodes: SchemaNodeDefinition[],
  options: CompileContext & { form: FormDescriptor; data?: Record<string, unknown> }
): Promise<CompiledSchema> {
  return compile(nodes, options, 'Form', options.form, options.data)
}
export function compileInfolist(
  nodes: SchemaNodeDefinition[],
  options: CompileContext
): Promise<CompiledSchema> {
  return compile(nodes, options, 'Infolist')
}
