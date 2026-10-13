import { isTranslationMarker, requestMessages, resolveTranslations } from '../i18n.js'
import { t } from '../i18n.js'
import { marked } from 'marked'
import {
  collectCatalogExtensions,
  extensionRenderProps,
  isRegisteredExtensionComponent,
} from '../builder/extensions.js'
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
  SchemaNodeBuilder,
  SchemaNamespace,
  RepeaterFieldDefinition,
} from '../definition/schema.js'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import {
  toDateTime,
  toIsoInZone,
  formatDate,
  formatDateTime,
  formatSince,
  formatOption,
  formatCompact,
  formatMoney,
  formatNumber,
  truncate,
} from '../format/index.js'
import { sanitizeHtml } from '../sanitize.js'
import { renderRichContent } from '../rich_content.js'
import type { RichContentOptions } from '../definition/rich_content.js'
import { evaluateClosure, liftClosure } from './closure_lifter.js'
import { type SpecCache, type StaticSlot } from './cache.js'
import {
  E_PUPITRE_FORBIDDEN,
  E_PUPITRE_INVALID_SPEC,
  E_PUPITRE_INVALID_REPEATER_TABLE,
  E_PUPITRE_UNLIFTABLE_CLOSURE,
} from '../errors.js'
import { getComponentDefinition, schema as schemaFactory } from '../builder/schema/schema.js'
import { authorizeAbility, authorizeModel, authorizeResource } from '../authz/bouncer.js'

import { compileActionDescriptor } from './action_compiler.js'
import type { ActionDefinition } from '../definition/action.js'
import { queryOptions } from '../options/query.js'
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
  resourceSlug?: string
  record?: Record<string, unknown> | null
  model?: LucidRow | null
  uploadUrls?: { upload: string; delete: string }
  resolveFileUrl?: (key: string, field: FieldDefinitionUnion) => Promise<string | null>
  cache?: { key: string; store: SpecCache } | null
}
export type CompiledSchema = {
  spec: JsonRenderSpec
  state: StateModel
  catalogVersion: string
  catalogExtensions: { name: string; components: string[] }[]
}
type SlotRequest = { options: CompileContext; form?: FormDescriptor }
type BuildContext = {
  elements: Record<string, Element>
  state: Record<string, unknown>
  slots: StaticSlot[]
  layoutId: number
  tabState: Record<string, string>
  options: CompileContext
  data: Record<string, unknown>
  numericFields: Record<string, true>
  builderBlocks: { path: string; name: string }[]
  repeaterPaths: string[]
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
const fieldType: Record<string, string> = {
  extensionField: '',
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
  markdownEditor: 'MarkdownEditor',
  codeEditor: 'CodeEditor',
  richEditor: 'RichEditor',
  fileUpload: 'FileUpload',
  repeater: 'Repeater',
  builder: 'Builder',
  slider: 'Slider',
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
export function headline(name: string): string {
  if (isTranslationMarker(name)) return name
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}
function pointer(path: string) {
  return path.split('.').filter(Boolean).join('/')
}
function builderFieldPath(path: string, scopes: { path: string; name: string }[]): string {
  let pattern = path
  for (const scope of [...scopes].reverse())
    pattern = pattern.replace(`${scope.path}.${scope.name}.data.`, `${scope.path}.*.data.`)
  return pattern
}
function repeatedFieldPath(path: string, repeaterPaths: string[]): string {
  const parts = path.split('.')
  let inserted = 0
  for (const repeaterPath of repeaterPaths) {
    const index = repeaterPath.split('.').length + inserted
    parts.splice(index, 0, '*')
    inserted += 1
  }
  return parts.join('.')
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
      if (node.kind === 'builder') {
        const builder = node as FieldDefinitionUnion & {
          blocks: { name: string; schema: SchemaNodeDefinition[] }[]
        }
        const initial =
          value === undefined && create && node.default !== undefined
            ? typeof node.default === 'function'
              ? (node.default as () => unknown)()
              : node.default
            : value
        const rows = Array.isArray(initial) ? initial : []
        const keyed = rows.map((row, index) => {
          const item = row as Record<string, unknown>
          const block = builder.blocks.find((candidate) => candidate.name === item.type)
          const blockData =
            item.data && typeof item.data === 'object' && !Array.isArray(item.data)
              ? (item.data as Record<string, unknown>)
              : {}
          if (block) defaults(block.schema, blockData, create)
          return { _key: item._key ?? `b${index}`, type: item.type, data: blockData }
        })
        setPath(data, node.name, keyed)
      } else if (node.kind === 'repeater') {
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
        if (!Array.isArray(value) || create) setPath(data, node.name, keyed)
        for (const row of keyed) defaults(template, row, create)
      } else if (value === undefined && create && 'default' in node && node.default !== undefined) {
        setPath(
          data,
          node.name,
          typeof node.default === 'function' ? (node.default as () => unknown)() : node.default
        )
      }
    }
    if (node.kind === 'wizard') for (const step of node.steps) defaults(step.children, data, create)
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
function addValueSlot(
  build: BuildContext,
  elementId: string,
  prop: string,
  evaluate: StaticSlot['evaluate']
): void {
  build.slots.push({ elementId, prop, evaluate })
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
  const result = liftClosure(closure, hidden ? 'hidden' : 'visible', {
    pathPrefix: '/data',
    inRepeater,
    numericFields: build.numericFields,
  })
  if (result.kind === 'static') addStatic(build, id, '@visible', closure, { invert: hidden })
  else build.elements[id].visible = result.value as never
}
function mapOptions(node: Record<string, unknown>, props: Record<string, unknown>) {
  if ('options' in node) props.options = optionsFor(node.options)
}
async function addField(
  node: FieldDefinitionUnion,
  build: BuildContext,
  parentPath = '',
  inRepeater = false,
  inBuilderBlock = false
): Promise<string> {
  const path = parentPath ? `${parentPath}.${node.name}` : node.name
  const id = `f.${path}`
  if (node.kind === 'repeater') {
    const definition = node as RepeaterFieldDefinition
    const children = repeaterChildren(definition.schema)
    if (
      definition.table?.length === 0 &&
      children.some((child) => 'label' in child && typeof child.label === 'function')
    )
      throw new E_PUPITRE_INVALID_REPEATER_TABLE([
        `"${path}" has closure-valued field labels; provide explicit table column labels`,
      ])
    const table =
      definition.table === undefined
        ? undefined
        : definition.table.length
          ? definition.table
          : children.map((child) => ({
              label:
                'label' in child && typeof child.label === 'string'
                  ? child.label
                  : headline('name' in child ? String(child.name) : child.kind),
              required: 'rules' in child && child.rules?.required === true,
            }))
    if (table && table.length !== children.length)
      throw new E_PUPITRE_INVALID_REPEATER_TABLE([
        `"${path}" has ${children.length} schema fields but ${table.length} columns; provide one column per field in schema order`,
      ])
    const templateId = `${id}.item`
    const templateChildren: string[] = []
    build.repeaterPaths.push(path)
    try {
      for (const [position, child] of children.entries()) {
        const childId = await addNode(child, build, path, true, false)
        if (table) build.elements[childId].props.label = table[position].label
        templateChildren.push(childId)
      }
    } finally {
      build.repeaterPaths.pop()
    }
    const defaultItem: Record<string, unknown> = {}
    defaults(children, defaultItem, true)
    const liftedLabel =
      !table && typeof definition.itemLabel === 'function'
        ? liftClosure(definition.itemLabel, 'label', {
            pathPrefix: `/data/${pointer(path)}`,
            inRepeater: true,
            numericFields: build.numericFields,
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
      ...(table ? { table } : {}),
      defaultItems: [],
    } as unknown as RepeaterDescriptor
    const statePath = inRepeater
      ? inBuilderBlock
        ? { $item: `data/${pointer(node.name)}` }
        : { $item: pointer(node.name) }
      : `/data/${pointer(path)}`
    if (!table && typeof definition.itemLabel === 'function' && liftedLabel?.kind === 'static') {
      const error = new E_PUPITRE_UNLIFTABLE_CLOSURE()
      error.message = `Cannot lift itemLabel for repeater "${path}"`
      throw error
    }
    // Item operations (remove/move/clone/collapse) need the runtime index and the
    // absolute array path, which json-render action params cannot express inside
    // nested repeat scopes; the Repeater UI performs them through its bound value.
    build.elements[templateId] = {
      type: 'RepeaterItem',
      props: {
        index: { $index: true },
        ...(!table &&
        definition.itemLabel !== undefined &&
        (typeof definition.itemLabel !== 'function' || liftedLabel?.kind !== 'static')
          ? {
              itemLabel:
                liftedLabel && liftedLabel.kind !== 'static'
                  ? liftedLabel.value
                  : definition.itemLabel,
            }
          : {}),
      },
      children: templateChildren,
    }
    const repeatValue = inRepeater
      ? { $bindItem: inBuilderBlock ? `data/${pointer(node.name)}` : pointer(node.name) }
      : { $bindState: statePath }
    const repeater: Element = {
      type: 'Repeater',
      props: {
        name: path,
        label:
          typeof node.label === 'string' || node.label === null ? node.label : headline(node.name),
        ...(node.helperText !== undefined ? { helperText: node.helperText } : {}),
        ...(node.hint !== undefined ? { hint: node.hint } : {}),
        ...(node.rules?.required ? { required: true } : {}),
        ...(node.columnSpan !== undefined ? { columnSpan: node.columnSpan } : {}),
        ...(node.disabled !== undefined && typeof node.disabled !== 'function'
          ? { disabled: node.disabled }
          : {}),
        ...(node.readOnly !== undefined ? { readOnly: node.readOnly } : {}),
        descriptor,
        value: repeatValue,
      },
      children: [templateId],
      repeat: { statePath, key: '_key' },
      on: {
        add: [
          { action: 'pushState', params: { statePath, value: { ...defaultItem, _key: '$id' } } },
        ],
      },
    }
    build.elements[id] = repeater
    if (typeof node.disabled === 'function') {
      const lifted = liftClosure(node.disabled, 'disabled', {
        pathPrefix: '/data',
        inRepeater,
        numericFields: build.numericFields,
      })
      if (lifted.kind === 'static') addStatic(build, id, 'disabled', node.disabled)
      else repeater.props.disabled = lifted.value
    }
    applyVisibility(node as unknown as Record<string, unknown>, id, build, inRepeater)
    addValueSlot(build, id, 'descriptor', (data) => ({
      ...descriptor,
      defaultItems: Array.isArray(getPath(data, path)) ? getPath(data, path) : [],
    }))
    return id
  }
  if (node.kind === 'builder') {
    const definition = node as FieldDefinitionUnion & {
      blocks: { name: string; label?: string; icon?: string; schema: SchemaNodeDefinition[] }[]
      minItems?: number
      maxItems?: number
      reorderable?: boolean
      collapsible?: boolean
      cloneable?: boolean
      addLabel?: string
      blockPickerColumns?: number
    }
    const blockTemplates = []
    for (const block of definition.blocks) {
      const templateId = `${id}.${block.name}.item`
      const children: string[] = []
      build.builderBlocks.push({ path, name: block.name })
      try {
        for (const child of block.schema)
          children.push(await addNode(child, build, `${path}.${block.name}.data`, true, true))
      } finally {
        build.builderBlocks.pop()
      }
      build.elements[templateId] = {
        type: 'BuilderItem',
        props: { block: block.name, index: { $index: true } },
        children,
      }
      blockTemplates.push({
        key: block.name,
        label: block.label ?? headline(block.name),
        icon: block.icon,
        template: templateId,
      })
    }
    const descriptor = {
      name: path,
      blocks: blockTemplates,
      minItems: definition.minItems,
      maxItems: definition.maxItems,
      reorderable: definition.reorderable ?? false,
      collapsible: definition.collapsible ?? false,
      cloneable: definition.cloneable ?? false,
      addLabel: definition.addLabel,
      blockPickerColumns: definition.blockPickerColumns,
    }
    const statePath = inRepeater
      ? inBuilderBlock
        ? { $item: `data/${pointer(node.name)}` }
        : { $item: pointer(node.name) }
      : `/data/${pointer(path)}`
    const props: Record<string, unknown> = {
      name: path,
      label:
        typeof node.label === 'string' || node.label === null ? node.label : headline(node.name),
      value: inRepeater
        ? { $bindItem: inBuilderBlock ? `data/${pointer(node.name)}` : pointer(node.name) }
        : { $bindState: statePath },
      descriptor,
    }
    if (node.helperText !== undefined) props.helperText = node.helperText
    if (node.hint !== undefined) props.hint = node.hint
    if (node.rules?.required) props.required = true
    if (node.disabled !== undefined && typeof node.disabled !== 'function')
      props.disabled = node.disabled
    if (node.columnSpan !== undefined) props.columnSpan = node.columnSpan
    if (node.extraAttributes !== undefined) props.extraAttributes = node.extraAttributes
    build.elements[id] = {
      type: 'Builder',
      props,
      children: blockTemplates.map((block) => block.template),
      repeat: { statePath, key: '_key' },
    }
    applyVisibility(node as unknown as Record<string, unknown>, id, build, inRepeater)
    return id
  }
  const type = node.kind === 'extensionField' ? node.component : fieldType[node.kind]
  const props: Record<string, unknown> = {
    name: path,
    label: typeof node.label === 'string' || node.label === null ? node.label : headline(node.name),
    value: inRepeater
      ? { $bindItem: inBuilderBlock ? `data/${pointer(node.name)}` : pointer(node.name) }
      : { $bindState: `/data/${pointer(path)}` },
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
  if (node.kind === 'extensionField') Object.assign(props, extensionRenderProps(node))
  if (node.kind === 'date' || node.kind === 'dateTime' || node.kind === 'time')
    addValueSlot(
      build,
      id,
      'timezone',
      (_data, _record, _ctx, request) => node.timezone ?? (request as SlotRequest).options.timezone
    )
  const excluded = new Set([
    'extension',
    'extensionKind',
    'component',
    'extensionProps',
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
    'fileAttachmentsDisk',
    'fileAttachmentsDirectory',
    'imageEditor',
    'imageEditorAspectRatios',
    'options',
    'mentions',
    'customBlocks',
    'relationship',
    'searchable',
    'preload',
    'getOptionLabelUsing',
    'createOptionForm',
    'createOptionUsing',
    'prefixAction',
    'suffixAction',
    'hintAction',
    'tel',
    'telRegex',
  ])
  for (const [key, value] of Object.entries(node))
    if (!excluded.has(key) && value !== undefined) props[key] = value
  if (node.kind === 'text') {
    if (node.tel || node.telRegex) props.type = 'tel'
    else if (node.rules?.url) props.type = 'url'
    else if (node.rules?.email) props.type = 'email'
  }
  if (node.kind === 'email' || node.kind === 'password') props.type = node.kind
  if (node.kind === 'multiSelect') props.multiple = true
  if ('minDate' in node && node.minDate !== undefined) props.min = node.minDate
  if ('maxDate' in node && node.maxDate !== undefined) props.max = node.maxDate
  mapOptions(node as unknown as Record<string, unknown>, props)
  if (node.kind === 'richEditor') {
    if (node.mergeTags)
      props.mergeTags = Array.isArray(node.mergeTags)
        ? node.mergeTags.map((tag) => ({ id: tag, label: tag }))
        : Object.entries(node.mergeTags).map(([tag, label]) => ({ id: tag, label }))
    if (node.mentions?.length)
      props.mentions = node.mentions.map((provider) => ({
        char: provider.char,
        ...(provider.options ? { options: provider.options } : {}),
      }))
    if (
      node.mentions?.some((provider) => provider.search) &&
      build.options.ctx &&
      build.options.resourceSlug
    )
      addValueSlot(build, id, 'optionsUrl', (_data, _record, context, request) => {
        const ctx = context as HttpContext
        const options = (request as SlotRequest).options
        const resource = ctx.pupitre.panel.resources.find(
          (candidate) => candidate.slug === options.resourceSlug
        )
        const recordKey = resource && options.model?.$getAttribute(resource.model.primaryKey)
        return `${ctx.pupitre.panel.path}/_pupitre/options/${options.resourceSlug}/${encodeURIComponent(path)}${recordKey === undefined || recordKey === null ? '' : `?record=${encodeURIComponent(String(recordKey))}`}`
      })
    if (node.customBlocks?.length)
      props.customBlocks = await Promise.all(
        node.customBlocks.map(async (block) => {
          const compiled = await compileForm(block.schema, {
            locale: build.options.locale,
            timezone: build.options.timezone,
            ctx: build.options.ctx,
            form: { method: 'post', url: '', submitLabel: t('Apply'), dirtyGuard: false },
          })
          return {
            id: block.id,
            label: block.label,
            icon: block.icon,
            spec: { $raw: compiled.spec },
            state: compiled.state,
          }
        })
      )
  }
  for (const key of ['prefixAction', 'suffixAction', 'hintAction'] as const) {
    const action = (node as unknown as Record<string, unknown>)[key] as ActionDefinition | undefined
    if (!action || !build.options.resourceSlug) continue
    addValueSlot(build, id, key, (_data, _record, context, request) => {
      const ctx = context as HttpContext | undefined
      const options = (request as SlotRequest).options
      const owner = ctx?.pupitre.panel.resources.find(
        (resource) => resource.slug === options.resourceSlug
      )
      if (!ctx || !owner) return undefined
      const record = options.model ?? undefined
      const effectiveAction = record ? action : { ...action, context: 'header' as const }
      return compileActionDescriptor(effectiveAction, {
        baseUrl: owner.urls.list,
        record,
        recordKey: record?.$getAttribute(owner.model.primaryKey) as string | number | undefined,
        ctx,
        authorize: (ability, row) => authorizeResource(ctx, owner, ability, row),
        routes: owner.urls,
        resourceLabel: owner.label,
      })
    })
  }
  if (
    (node.kind === 'select' || node.kind === 'multiSelect') &&
    (typeof node.options === 'function' || node.relationship)
  ) {
    const initialContext = build.options.ctx
    const ownerSlug = build.options.resourceSlug
    if (initialContext && ownerSlug) {
      const optionsUrl = (context: unknown, request: unknown) =>
        `${(context as HttpContext).pupitre.panel.path}/_pupitre/options/${(request as SlotRequest).options.resourceSlug}/${encodeURIComponent(path)}`
      addValueSlot(build, id, 'optionsUrl', (_data, _record, context, request) =>
        optionsUrl(context, request)
      )
      props.searchable = node.searchable ?? true
      props.preload = node.preload ?? false
      if (node.createOptionForm?.length)
        addValueSlot(build, id, 'createOption', (_data, _record, context, request) => {
          const ctx = context as HttpContext
          const owner = ctx.pupitre.panel.resources.find(
            (resource) => resource.slug === (request as SlotRequest).options.resourceSlug
          )
          return owner
            ? {
                url: optionsUrl(context, request),
                catalogExtensions: collectCatalogExtensions(node.createOptionForm),
              }
            : undefined
        })
      const visibilityHidden = typeof node.hidden === 'function'
      const visibilityClosure = visibilityHidden ? node.hidden : node.visible
      const serverVisibility =
        typeof visibilityClosure === 'function' &&
        liftClosure(visibilityClosure, visibilityHidden ? 'hidden' : 'visible', {
          pathPrefix: '/data',
          inRepeater,
          numericFields: build.numericFields,
        }).kind === 'static'
      addValueSlot(build, id, 'options', async (data, record, context, request) => {
        const requestContext = context as HttpContext
        const owner = requestContext.pupitre.panel.resources.find(
          (resource) => resource.slug === (request as SlotRequest).options.resourceSlug
        )
        if (
          serverVisibility &&
          ((typeof node.hidden === 'function' &&
            (await evaluateClosure(node.hidden, data, record, requestContext)) === true) ||
            (typeof node.visible === 'function' &&
              (await evaluateClosure(node.visible, data, record, requestContext)) === false))
        )
          return []
        const selected = getPath(data, path)
        const selectedValues = Array.isArray(selected)
          ? selected
          : selected === undefined || selected === null || selected === ''
            ? []
            : [selected]
        let page = 1
        let hasMore = true
        const options: Option[] = []
        while (hasMore) {
          if (node.preload && node.relationship && owner) {
            let relatedModel: LucidModel
            try {
              relatedModel = owner.model.$getRelation(node.relationship.name).relatedModel()
            } catch {
              throw new Error(`Unknown relationship "${node.relationship.name}"`)
            }
            if (!(await authorizeModel(requestContext, relatedModel, 'viewAny')))
              throw new E_PUPITRE_FORBIDDEN()
          }
          const result = await queryOptions({
            ctx: requestContext,
            ...(owner ? { owner } : {}),
            field: node,
            selected: node.preload ? [] : selectedValues,
            page,
            selectedOnly: !node.preload,
          })
          options.push(...result.options)
          hasMore = Boolean(node.preload && result.hasMore)
          page += 1
        }
        return options
      })
    }
  }
  if (
    (node.kind === 'select' || node.kind === 'multiSelect') &&
    build.options.ctx &&
    (!build.options.resourceSlug ||
      !build.options.ctx.pupitre.panel.resources.some(
        (resource) => resource.slug === build.options.resourceSlug
      ))
  ) {
    const initialContext = build.options.ctx
    const ownerSlug = build.options.resourceSlug
    const initialPage = initialContext.pupitre.panel.pages?.find(
      (candidate) => candidate.slug === ownerSlug
    )
    for (const key of ['prefixAction', 'suffixAction'] as const) {
      const action = node[key]
      if (!action) continue
      if (
        initialPage &&
        initialPage.definition.actions.some((candidate) => candidate.name === action.name)
      ) {
        addValueSlot(build, id, key, (_data, _record, context, request) => {
          const ctx = context as HttpContext
          const page = ctx.pupitre.panel.pages?.find(
            (candidate) => candidate.slug === (request as SlotRequest).options.resourceSlug
          )
          if (!page) return undefined
          return compileActionDescriptor(action, {
            baseUrl: page.url,
            ctx,
            authorize: (ability) => authorizeAbility(ctx, ability),
            routes: {
              list: page.url,
              create: page.url,
              edit: () => page.url,
              view: () => page.url,
              destroy: () => page.url,
            },
          })
        })
      } else if (action.url && !action.can && !action.builtin) {
        addValueSlot(build, id, key, (_data, _record, context) => {
          const ctx = context as HttpContext
          const baseUrl = ctx.pupitre.panel.path
          return compileActionDescriptor(action, {
            baseUrl,
            ctx,
            authorize: async () => true,
            routes: {
              list: baseUrl,
              create: `${baseUrl}/create`,
              edit: (recordId) => `${baseUrl}/${encodeURIComponent(String(recordId))}/edit`,
              view: (recordId) => `${baseUrl}/${encodeURIComponent(String(recordId))}`,
              destroy: (recordId) => `${baseUrl}/${encodeURIComponent(String(recordId))}`,
            },
          })
        })
      }
    }
  }
  if (node.kind === 'fileUpload') {
    const maxSize =
      typeof node.maxSize === 'number'
        ? node.maxSize
        : typeof node.maxSize === 'string'
          ? parseFileSize(node.maxSize)
          : undefined
    const descriptor = {
      name: path,
      multiple: node.multiple ?? false,
      accept: typeof node.accept === 'string' ? [node.accept] : node.accept,
      maxSize,
      maxFiles: node.maxFiles,
      image: node.image ?? false,
      directory: node.directory,
      visibility: node.visibility,
      imageEditor: node.imageEditor ?? false,
      imageEditorAspectRatios: node.imageEditorAspectRatios,
      reorderable: node.reorderable ?? false,
      downloadable: node.downloadable ?? false,
      previewable: node.previewable ?? true,
    }
    addValueSlot(build, id, 'descriptor', (_data, _record, _ctx, request) => {
      const { uploadUrls } = (request as SlotRequest).options
      return {
        ...descriptor,
        uploadUrl: uploadUrls?.upload ?? '',
        deleteUrl: uploadUrls?.delete ?? '',
      }
    })
  }
  if (node.kind === 'markdownEditor')
    addValueSlot(
      build,
      id,
      'uploadUrl',
      (_data, _record, _ctx, request) => (request as SlotRequest).options.uploadUrls?.upload ?? ''
    )
  if (node.live) props.live = node.live === true ? true : node.live
  build.elements[id] = { type, props }
  for (const prop of ['label', 'disabled', 'placeholder'] as const) {
    const closure = node[prop]
    if (typeof closure !== 'function') continue
    const lifted = liftClosure(closure, prop === 'placeholder' ? 'content' : prop, {
      pathPrefix: '/data',
      inRepeater,
      numericFields: build.numericFields,
    })
    if (lifted.kind === 'static') addStatic(build, id, prop, closure)
    else props[prop] = lifted.value
  }
  applyVisibility(node as unknown as Record<string, unknown>, id, build, inRepeater)
  if (typeof node.afterStateUpdated === 'function') {
    const server = typeof node.live === 'object' && node.live.server === true
    const lifted = server
      ? undefined
      : liftClosure(node.afterStateUpdated, 'afterStateUpdated', {
          pathPrefix: '/data',
          inRepeater,
          numericFields: build.numericFields,
        })
    if (!server && lifted?.kind === 'static') {
      const error = new E_PUPITRE_UNLIFTABLE_CLOSURE()
      error.message = `Cannot lift afterStateUpdated for field "${path}". Use live({ server: true }) to run it on the server.`
      throw error
    }
    if (server) {
      build.elements[id].watch = {
        [`/data/${pointer(path)}`]: [
          {
            action: 'evaluate',
            params: {
              url: `${build.options.ctx?.pupitre.panel.path ?? ''}/_pupitre/evaluate`,
              resource: build.options.resourceSlug ?? '',
              field: inRepeater
                ? repeatedFieldPath(
                    builderFieldPath(path, build.builderBlocks),
                    build.repeaterPaths
                  )
                : builderFieldPath(path, build.builderBlocks),
              debounce:
                typeof node.live === 'object' && typeof node.live.debounce === 'number'
                  ? node.live.debounce
                  : 0,
            },
          },
        ],
      }
    } else if (lifted && lifted.kind !== 'static') {
      build.elements[id].watch = { [`/data/${pointer(path)}`]: lifted.value as unknown[] }
    }
  }
  return id
}
function stepFieldPaths(nodes: SchemaNodeDefinition[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if ('name' in node && typeof node.name === 'string') paths.push(node.name)
    if ('children' in node) paths.push(...stepFieldPaths(node.children))
    if (node.kind === 'repeater') paths.push(...stepFieldPaths(repeaterChildren(node.schema)))
  }
  return paths
}
function wizardSubmitLabel(nodes: SchemaNodeDefinition[]): string | undefined {
  for (const node of nodes) {
    if (node.kind === 'wizard' && node.submitLabel) return node.submitLabel
    if ('children' in node) {
      const label = wizardSubmitLabel(node.children)
      if (label) return label
    }
    if (node.kind === 'wizard') {
      const label = wizardSubmitLabel(node.steps.flatMap((step) => step.children))
      if (label) return label
    }
  }
}
async function addNode(
  node: SchemaNodeDefinition,
  build: BuildContext,
  parentPath = '',
  inRepeater = false,
  inBuilderBlock = false
): Promise<string> {
  if (fieldKinds[node.kind])
    return addField(node as FieldDefinitionUnion, build, parentPath, inRepeater, inBuilderBlock)
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
        ids.push(await addNode(child, build, parentPath, inRepeater, inBuilderBlock))
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
  } else if (node.kind === 'wizard') {
    const wizard = node as unknown as {
      steps: {
        name: string
        description?: string
        icon?: string
        children: SchemaNodeDefinition[]
      }[]
      skippable?: boolean
      startOnStep?: number
      submitLabel?: string
    }
    const steps = []
    for (const step of wizard.steps) {
      const key = step.name
      const stepId = `l.${build.layoutId++}`
      const ids: string[] = []
      for (const child of step.children)
        ids.push(await addNode(child, build, parentPath, inRepeater, inBuilderBlock))
      build.elements[stepId] = {
        type: 'Step',
        props: { key, label: headline(key), description: step.description, icon: step.icon },
        children: ids,
      }
      childIds.push(stepId)
      steps.push({
        key,
        label: headline(key),
        description: step.description,
        icon: step.icon,
        fields: stepFieldPaths(step.children),
      })
    }
    const statePath = `/ui/wizard/${id}/step`
    const initialStep = steps.length
      ? Math.max(0, Math.min((wizard.startOnStep ?? 1) - 1, steps.length - 1))
      : 0
    const stateUi =
      build.state.ui && typeof build.state.ui === 'object'
        ? (build.state.ui as Record<string, unknown>)
        : {}
    const wizardStates =
      stateUi.wizard && typeof stateUi.wizard === 'object'
        ? (stateUi.wizard as Record<string, unknown>)
        : {}
    build.state.ui = { ...stateUi, wizard: { ...wizardStates, [id]: { step: initialStep } } }
    build.elements[id] = {
      type: 'Wizard',
      props: {
        id,
        steps,
        step: { $bindState: statePath },
        skippable: wizard.skippable ?? false,
        submitLabel: wizard.submitLabel,
      },
      children: childIds,
    }
  } else {
    for (const child of children as SchemaNodeDefinition[])
      childIds.push(await addNode(child, build, parentPath, inRepeater, inBuilderBlock))
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
        if (node.kind === 'html') addStatic(build, id, 'content', closure, { sanitize: true })
        else {
          const lifted = liftClosure(closure, 'content', {
            pathPrefix: '/data',
            inRepeater,
            numericFields: build.numericFields,
          })
          if (lifted.kind === 'static') addStatic(build, id, 'content', closure)
          else props.content = lifted.value
        }
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
  const props: Record<string, unknown> = {
    label: typeof entry.label === 'string' || entry.label === null ? entry.label : headline(path),
  }
  for (const [key, prop] of Object.entries(entry))
    if (
      ![
        'kind',
        'richContent',
        'name',
        'label',
        'value',
        'url',
        'schema',
        'options',
        'extension',
        'extensionKind',
        'component',
        'extensionProps',
        'visible',
        'hidden',
        'format',
      ].includes(key) &&
      prop !== undefined &&
      typeof prop !== 'function'
    )
      props[key] = prop
  if (entry.markdown === true) props.html = true
  if (entry.richContent) props.html = true
  if (node.kind === 'extensionEntry') {
    Object.assign(props, extensionRenderProps(node))
    addValueSlot(build, id, 'record', (_data, record) => record)
  }
  // Column labels for every repeatable entry; custom children also carry their component.
  if (node.kind === 'repeatableEntry' && node.schema?.length) {
    props.entries = node.schema.map((child) => ({
      name: child.name,
      label: child.label ?? headline(child.name),
      ...(child.kind === 'extensionEntry'
        ? { component: child.component, props: extensionRenderProps(child) }
        : {}),
    }))
  }
  addValueSlot(build, id, 'value', async (_data, record, _ctx, request) => {
    const current = request as SlotRequest
    return formatEntryValue(entry, getPath(record ?? {}, path), current.options, path)
  })
  if (entry.kind === 'badgeEntry' && entry.colors && typeof entry.colors === 'object')
    addValueSlot(
      build,
      id,
      'color',
      (_data, record) =>
        (entry.colors as Record<string, unknown>)[String(getPath(record ?? {}, path))]
    )
  if (typeof entry.url === 'function') addStatic(build, id, 'url', entry.url as Function)
  build.elements[id] = {
    type: node.kind === 'extensionEntry' ? node.component : infolistType[String(entry.kind)],
    props,
  }
  applyVisibility(entry, id, build, false)
  return id
}
async function formatEntryValue(
  entry: Record<string, unknown>,
  value: unknown,
  options: CompileContext,
  path: string
): Promise<unknown> {
  if (typeof entry.format === 'function') return entry.format(value, options.record ?? {})
  if (value === null || value === undefined) return value
  if (entry.options && typeof entry.options === 'object') {
    const label = formatOption(value, entry.options as Record<string, unknown> | readonly unknown[])
    const localizedLabel = resolveTranslations(
      label,
      options.locale,
      options.ctx ? (requestMessages.get(options.ctx) ?? {}) : {}
    )
    return entry.limit ? truncate(localizedLabel, Number(entry.limit)) : localizedLabel
  }
  const context = {
    locale: options.locale,
    numberLocale: options.ctx?.pupitre?.numberLocale,
    timezone: String(entry.timezone ?? options.timezone),
  }
  if (entry.dateTime) return formatDateTime(value as string, context, String(entry.dateTime))
  if (entry.date) return formatDate(value as string, context, String(entry.date))
  if (entry.since) return formatSince(value as string, context)
  // Compact entries deliver `{ value, title }`: the short text plus the full value to copy.
  if (entry.compact && (entry.money || (entry.numeric && typeof value === 'number')))
    return formatCompact(value as number | string, context, {
      ...(entry.money ? { currency: String(entry.money) } : {}),
    })
  if (entry.money)
    return formatMoney(value as number | string, context, { currency: String(entry.money) })
  value = resolveTranslations(
    value,
    options.locale,
    options.ctx ? (requestMessages.get(options.ctx) ?? {}) : {}
  )
  if (entry.limit) return truncate(value, Number(entry.limit))
  if (entry.richContent && typeof value === 'string') {
    const config =
      typeof entry.richContent === 'function'
        ? await entry.richContent({
            record: options.record ?? {},
            ctx: options.ctx,
            get: (name: string) => getPath(options.record ?? {}, name),
          })
        : entry.richContent
    return renderRichContent(value, config as RichContentOptions)
  }
  if (entry.markdown === true && typeof value === 'string')
    return sanitizeHtml(marked.parse(value, { async: false }) as string)
  if (entry.html && typeof value === 'string') return renderRichContent(value)
  if (entry.kind === 'imageEntry' && options.resolveFileUrl) {
    const field = { kind: 'fileUpload', name: path } as FieldDefinitionUnion
    const resolve = async (key: unknown) =>
      typeof key === 'string' ? ((await options.resolveFileUrl!(key, field)) ?? key) : key
    return Array.isArray(value) ? Promise.all(value.map(resolve)) : resolve(value)
  }
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
                  await formatEntryValue(
                    child,
                    getPath(record, String(child.name)),
                    { ...options, record },
                    `${path}.${String(child.name)}`
                  ),
                ] as const
            )
          )
        )
      })
    )
  }
  if (entry.kind === 'keyValueEntry' && typeof value === 'object') return value
  if (entry.kind === 'codeEntry' && typeof value !== 'string') return JSON.stringify(value, null, 2)
  if (typeof value === 'number' && entry.numeric) return formatNumber(value, context)
  return value
}

function normalizeFormData(
  nodes: SchemaNodeDefinition[],
  data: Record<string, unknown>,
  timezone: string,
  record: Record<string, unknown> | null
): void {
  for (const node of nodes) {
    if (node.kind === 'wizard') {
      for (const step of node.steps) normalizeFormData(step.children, data, timezone, record)
      continue
    }
    if (node.kind === 'builder') {
      const definition = node as FieldDefinitionUnion & {
        blocks: { name: string; schema: SchemaNodeDefinition[] }[]
      }
      const items = getPath(data, node.name)
      if (Array.isArray(items))
        for (const item of items) {
          if (!item || typeof item !== 'object' || !('type' in item) || !('data' in item)) continue
          const block = definition.blocks.find((candidate) => candidate.name === item.type)
          if (block && item.data && typeof item.data === 'object' && !Array.isArray(item.data))
            normalizeFormData(block.schema, item.data as Record<string, unknown>, timezone, record)
        }
      continue
    }
    if (node.kind === 'repeater') {
      const rows = getPath(data, node.name)
      const children = repeaterChildren(node.schema)
      if (Array.isArray(rows))
        for (const row of rows)
          normalizeFormData(children, row as Record<string, unknown>, timezone, record)
      continue
    }
    // Layouts (section, tabs, grid, …) are transparent for state paths.
    if ('children' in node && Array.isArray(node.children)) {
      normalizeFormData(node.children, data, timezone, record)
      continue
    }
    if (!fieldKinds[node.kind] || !('name' in node)) continue
    const field = node as FieldDefinitionUnion
    if (typeof field.format === 'function' && record)
      setPath(data, field.name, field.format(record))
    const value = getPath(data, field.name)
    if (field.kind === 'dateTime' && value !== null && value !== undefined)
      setPath(data, field.name, toIsoInZone(value as string, field.timezone ?? timezone))
    // Calendar dates have no instant: never shift them through a timezone.
    if (field.kind === 'date' && value !== null && value !== undefined)
      setPath(data, field.name, toDateTime(value as string)?.toISODate() ?? null)
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
      const value = await slot.evaluate(data, options.record ?? null, options.ctx, {
        options,
        form,
      })
      if (slot.prop === '@visible') spec.elements[slot.elementId]!.visible = value as never
      else spec.elements[slot.elementId]!.props[slot.prop] = value
    }
    validateOutput(spec)
    return { spec, state, catalogVersion, catalogExtensions: collectCatalogExtensions(spec) }
  }
  const numericFields: Record<string, true> = {}
  const pending = [...nodes]
  while (pending.length) {
    const current = pending.pop()!
    if (current.kind === 'number') numericFields[current.name] = true
    if (current.kind === 'repeater')
      pending.push(...repeaterChildren((current as RepeaterFieldDefinition).schema))
    if ('children' in current && Array.isArray(current.children))
      pending.push(...(current.children as SchemaNodeDefinition[]))
  }
  const build: BuildContext = {
    elements: {},
    state: {},
    slots: [],
    layoutId: 0,
    tabState: {},
    options,
    data,
    numericFields,
    builderBlocks: [],
    repeaterPaths: [],
  }
  const children: string[] = []
  for (const node of nodes) children.push(await addNode(node, build))
  build.elements.root = { type: rootType, props: {}, children }
  if (form)
    for (const key of Object.keys(form))
      addValueSlot(build, 'root', key, (_data, _record, _ctx, request) => {
        const current = request as SlotRequest
        if (key === 'submitLabel') return wizardSubmitLabel(nodes) ?? current.form?.submitLabel
        return current.form?.[key as keyof FormDescriptor]
      })
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
  if (cacheOption) {
    const cacheSpec = structuredClone({
      ...baseSpec,
      state: {
        ...state,
        data: {},
        meta: { record: null, dirty: false, submitting: false },
      },
    })
    cacheOption.store.set(cacheOption.key, { spec: cacheSpec, slots: build.slots })
  }
  const spec = structuredClone(baseSpec)
  for (const slot of build.slots) {
    const value = await slot.evaluate(data, options.record ?? null, options.ctx, { options, form })
    if (slot.prop === '@visible') spec.elements[slot.elementId]!.visible = value as never
    else spec.elements[slot.elementId]!.props[slot.prop] = value
  }
  validateOutput(spec)
  return { spec, state, catalogVersion, catalogExtensions: collectCatalogExtensions(spec) }
}
function validateOutput(spec: JsonRenderSpec): void {
  if (process.env.NODE_ENV === 'production') return
  const catalogResult = jsonRenderSpec.safeParse(spec)
  const issues = validateSpec(spec as never)
  const componentIssues = Object.entries(spec.elements).flatMap(
    ([id, element]): { id: string; issues: unknown[] }[] => {
      const definition =
        pupitreCatalog.components[element.type as keyof typeof pupitreCatalog.components]
      if (!definition)
        return isRegisteredExtensionComponent(element.type)
          ? []
          : [
              {
                id,
                issues: [
                  {
                    code: 'custom',
                    path: ['type'],
                    message: `Unknown Pupitre component "${element.type}"; register its catalog extension on the server.`,
                  },
                ],
              },
            ]
      const result = definition.props.safeParse(element.props)
      return result.success ? [] : [{ id, issues: result.error.issues }]
    }
  )
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
