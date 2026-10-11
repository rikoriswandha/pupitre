import app from '@adonisjs/core/services/app'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { HttpContext } from '@adonisjs/core/http'
import { compileForm, compileInfolist } from '../../compiler/schema_compiler.js'
import { validateResourceData } from '../validation.js'
import { compileTable } from '../../compiler/table_compiler.js'
import { applyTableQuery, parseTableParams } from '../../query/table_query.js'
import { buildTableData } from '../../table/table_data.js'
import { aggregateTableSummaries } from '../../table/table_summary.js'
import { compileActionDescriptor, executeBuiltinDelete } from '../../compiler/action_compiler.js'
import { compileValidator } from '../../compiler/vine_compiler.js'
import { ensureAuthorized, authorizeResource } from '../../authz/bouncer.js'
import { prepareWidgets } from '../../widgets/controller.js'
import { buildPageProps } from '../page_props.js'
import { isPupitreActionRequest, actionJson, errorJson, setPupitreFlash } from '../responses.js'
import type { ResourceRuntime } from '../../manager.js'
import type { ActionDefinition } from '../../definition/action.js'
import { isReadOnlyResource } from '../../definition/resource.js'
import { walkSchema } from '../../definition/walk.js'
import { valuesAt } from '../../definition/values_at.js'
import type { FieldDefinitionUnion, SchemaNodeDefinition } from '../../definition/schema.js'
import { resolveFileUrl, cleanupReplacedFiles } from '../../storage/index.js'
import type { UploadField } from '../../storage/index.js'
import { findUploadField } from '../../storage/upload_validation.js'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import { createSpecCacheKey, SpecCache } from '../../compiler/cache.js'
import type { PupitreConfig } from '../../define_config.js'
import type {
  ActionDescriptor,
  JsonRenderSpec,
  RelationDescriptor,
  SubNavigationItem,
  WidgetDescriptor,
  TableData,
} from '../../../catalog/wire.js'
import { tableData as tableDataSchema } from '../../../catalog/wire.js'
import { actions as builtInActions } from '../../builder/action.js'
import { requestResource, scopedQuery } from '../../query/scoped_query.js'
import { fillTenantOwnership } from '../../tenancy/runtime.js'
import {
  fillRelationshipRepeaters,
  resourceAttributes,
  syncRelationshipRepeaters,
} from '../repeater_relationships.js'
import { compileRelationDescriptor, loadRelationTableData } from './relation_controller.js'
import { flattenRelationManagers } from '../../definition/relation_manager.js'
import { E_PUPITRE_NOT_FOUND } from '../../errors.js'
import { publishResourceChange, resourceRealtime } from '../../realtime.js'
const schemaCache = new SpecCache<JsonRenderSpec>()

type PreparedPageWidgets = {
  widgets: WidgetDescriptor[]
  deferred: string[]
  extraProps: Record<string, unknown>
}

async function pageWidgets(
  ctx: HttpContext,
  target: ResourceRuntime,
  kind: 'list' | 'create' | 'edit' | 'view',
  record?: LucidRow
): Promise<PreparedPageWidgets> {
  const page = target.definition.pages[kind]
  const context = { resource: target.slug, widgetPage: kind }
  const header = await prepareWidgets(ctx, page?.widgets ?? [], record, 'header', context)
  const footer = await prepareWidgets(ctx, page?.footerWidgets ?? [], record, 'footer', context)
  return {
    widgets: [...header.widgets, ...footer.widgets],
    deferred: [...header.deferred, ...footer.deferred],
    extraProps: { ...header.extraProps, ...footer.extraProps },
  }
}

const nestedParents = new WeakMap<HttpContext, LucidRow>()
async function resource(ctx: HttpContext): Promise<ResourceRuntime> {
  const target = requestResource(ctx, ctx.params.slug)
  if (!target) throw new Error(`Unknown Pupitre resource "${ctx.params.slug}"`)
  if (target.parent) {
    const parentResource = requestResource(ctx, target.parent.resource)
    if (!parentResource) throw new E_PUPITRE_NOT_FOUND()
    await ensureAuthorized(ctx, parentResource, 'viewAny')
    const parent = await scopedQuery(ctx, parentResource)
      .where(keyName(parentResource.model), ctx.params[target.parent.param])
      .first()
    if (!parent) throw new E_PUPITRE_NOT_FOUND()
    await ensureAuthorized(ctx, parentResource, 'view', parent)
    nestedParents.set(ctx, parent)
  }
  return target
}
async function authorizeNestedMutation(ctx: HttpContext, target: ResourceRuntime) {
  if (!target.parent) return
  const parent = nestedParents.get(ctx)
  const parentResource = requestResource(ctx, target.parent.resource)
  if (!parent || !parentResource) throw new E_PUPITRE_NOT_FOUND()
  await ensureAuthorized(ctx, parentResource, 'update', parent)
}

function applyNestedOwnership(
  ctx: HttpContext,
  target: ResourceRuntime,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (!target.parent) return data
  const parent = nestedParents.get(ctx)
  const parentResource = requestResource(ctx, target.parent.resource)
  if (!parent || !parentResource) throw new E_PUPITRE_NOT_FOUND()
  const relation = target.model.$getRelation(target.parent.relation)
  relation.boot()
  if (relation.type !== 'belongsTo') throw new E_PUPITRE_NOT_FOUND()
  return {
    ...data,
    [(relation as { foreignKey: string }).foreignKey]: parent.$getAttribute(
      keyName(parentResource.model)
    ),
  }
}
function nestedParentBreadcrumb(
  ctx: HttpContext,
  target: ResourceRuntime
): { label: string; url: string } | undefined {
  if (!target.parent) return undefined
  const parent = nestedParents.get(ctx)
  const parentResource = requestResource(ctx, target.parent.resource)
  if (!parent || !parentResource) return undefined
  const id = parent.$getAttribute(keyName(parentResource.model)) as string | number
  const title = parentResource.definition.recordTitle ?? keyName(parentResource.model)
  return {
    label: String(parent.$getAttribute(title) ?? id),
    url: parentResource.urls.edit(id),
  }
}
function resourceSubNavigation(
  ctx: HttpContext,
  target: ResourceRuntime,
  kind: 'list' | 'create' | 'edit' | 'view',
  recordId: string | number | undefined,
  relations: RelationDescriptor[]
): SubNavigationItem[] {
  if (recordId === undefined || (kind !== 'edit' && kind !== 'view')) return []
  const items: SubNavigationItem[] = []
  if (target.definition.pages.edit) {
    items.push({
      key: 'edit',
      label: 'Edit',
      url: target.urls.edit(recordId),
      active: kind === 'edit' && !ctx.request.qs().relation,
    })
  }
  if (target.definition.pages.view) {
    items.push({
      key: 'view',
      label: 'View',
      url: target.urls.view(recordId),
      active: kind === 'view' && !ctx.request.qs().relation,
    })
  }
  if (relations.length) {
    items.push({
      key: 'relations',
      label: 'Relations',
      url: '#resource-relations',
      active: false,
    })
  }
  for (const child of ctx.pupitre.panel.resources) {
    if (child.parent?.resource !== target.slug) continue
    const childUrl = child.urls.list.replace(
      `:${child.parent.param}`,
      encodeURIComponent(String(recordId))
    )
    items.push({
      key: `nested:${child.slug}`,
      label: child.pluralLabel,
      url: childUrl,
      active: ctx.request.url().split('?')[0]?.startsWith(childUrl) ?? false,
    })
  }
  return items
}

function setRedirectFlash(ctx: HttpContext, flash: unknown) {
  if (!isPupitreActionRequest(ctx) && ctx.request.accepts(['json', 'html']) !== 'json')
    setPupitreFlash(ctx, flash)
}

function pruneUploads(
  ctx: HttpContext,
  resourceSlug: string,
  consumed: Map<string, string>,
  richEditorFields: Set<string>
) {
  const uploads = (ctx.session.get('pupitre.uploads') ?? []) as {
    resource: string
    key: string
    field: string
  }[]
  ctx.session.put(
    'pupitre.uploads',
    uploads.filter(
      (upload) =>
        !(
          upload.resource === resourceSlug &&
          (consumed.get(upload.key) === upload.field || richEditorFields.has(upload.field))
        )
    )
  )
}

function uploadFields(nodes: SchemaNodeDefinition[]): UploadField[] {
  const fields: UploadField[] = []
  walkSchema(nodes, (node, path) => {
    if (node.kind === 'fileUpload') fields.push({ ...node, name: path } as UploadField)
  })
  return fields
}

function richEditorFieldNames(nodes: SchemaNodeDefinition[]): string[] {
  const fields: string[] = []
  walkSchema(nodes, (node, path) => {
    if (node.kind === 'richEditor' || node.kind === 'markdownEditor') fields.push(path)
  })
  return fields
}

function consumedUploads(
  fields: UploadField[],
  data: Record<string, unknown>
): Map<string, string> {
  const consumed = new Map<string, string>()
  for (const field of fields) {
    for (const value of valuesAt(data, field.name)) {
      for (const key of Array.isArray(value) ? value : [value]) {
        if (typeof key === 'string') consumed.set(key, field.name)
      }
    }
  }
  return consumed
}

function recordValue(record: LucidRow, name: string): unknown {
  return valuesAt(record.serialize() as Record<string, unknown>, name).at(-1)
}

function serialized(record: LucidRow): Record<string, unknown> {
  return record.serialize() as Record<string, unknown>
}
function serializedValue(record: LucidRow, name: string): unknown[] {
  return valuesAt(serialized(record), name)
}

function keyName(model: LucidModel): string {
  return (model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
}

async function findRecord(ctx: HttpContext, target: ResourceRuntime): Promise<LucidRow | null> {
  return scopedQuery(ctx, target).where(keyName(target.model), ctx.params.id).first()
}

function handleActionValidation(ctx: HttpContext, error: unknown): boolean {
  if (ctx.request.header('x-pupitre-action') !== '1' || !error || typeof error !== 'object')
    return false
  const messages =
    'messages' in error && Array.isArray(error.messages)
      ? (error.messages as { field?: string; message: string }[])
      : []
  const errors: Record<string, string[]> = {}
  for (const message of messages) {
    const field = message.field ?? '_form'
    ;(errors[field] ??= []).push(message.message)
  }
  if (messages.length === 0 && 'message' in error && typeof error.message === 'string') {
    errors._form = [error.message]
  }
  errorJson(ctx, 'The submitted data is invalid', 422, errors)
  return true
}
async function schemaContext(
  ctx: HttpContext,
  target: ResourceRuntime,
  page: string,
  record?: LucidRow | null
) {
  const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
  const cache =
    app.inProduction || config.cache?.dev
      ? {
          key: createSpecCacheKey(
            `${ctx.pupitre.panel.id}@${ctx.pupitre.panel.path}`,
            target.slug,
            page,
            ctx.pupitre.locale,
            target.definition
          ),
          store: schemaCache,
        }
      : null
  return {
    ctx,
    resourceSlug: target.slug,
    locale: ctx.pupitre.locale,
    timezone: ctx.pupitre.timezone,
    ...(record ? { model: record, record: serialized(record) } : {}),
    uploadUrls: {
      upload: `${ctx.pupitre.panel.path}/_pupitre/upload`,
      delete: `${ctx.pupitre.panel.path}/_pupitre/upload`,
    },
    resolveFileUrl: (key: string, field: FieldDefinitionUnion) => {
      const uploadField = findUploadField(target.definition.form, field.name)
      return uploadField
        ? resolveFileUrl(key, uploadField)
        : field.kind === 'fileUpload'
          ? resolveFileUrl(key, field as UploadField)
          : Promise.resolve(null)
    },
    cache,
  }
}

async function compileActions(
  ctx: HttpContext,
  target: ResourceRuntime,
  actions: ActionDefinition[],
  record?: LucidRow,
  rowContext = false
): Promise<ActionDescriptor[]> {
  const modalList = target.definition.pages.list?.modals === true
  const routes = modalList
    ? {
        ...target.urls,
        create: target.urls.actions('create'),
        edit: (id: string | number) => target.urls.actions('edit', id),
      }
    : target.urls
  return Promise.all(
    actions.map((action) => {
      const definition =
        modalList && (action.builtin === 'create' || action.builtin === 'edit')
          ? { ...action, form: target.definition.form as never }
          : action
      return compileActionDescriptor(
        rowContext ? { ...definition, keyBindings: undefined } : definition,
        {
          baseUrl: target.urls.list,
          ...(record
            ? { record, recordKey: recordValue(record, keyName(target.model)) as string | number }
            : {}),
          ctx,
          authorize: (ability, row) => authorizeResource(ctx, target, ability, row),
          routes,
          resourceLabel: record ? target.label : target.pluralLabel,
        }
      )
    })
  )
}
function headerDefinitions(
  target: ResourceRuntime,
  page: 'list' | 'create' | 'edit' | 'view'
): ActionDefinition[] {
  const definitions = [...(target.definition.actions?.header ?? [])]
  if (
    page === 'list' &&
    (target.definition.pages.create || target.definition.pages.list?.modals) &&
    !definitions.some((item) => item.name === 'create')
  ) {
    definitions.push(builtInActions.create().definition)
  }
  if (
    (page === 'edit' || page === 'view') &&
    target.definition.pages.view &&
    !definitions.some((item) => item.name === 'view')
  ) {
    definitions.push(builtInActions.view().definition)
  }
  if (
    (page === 'edit' || page === 'view') &&
    !isReadOnlyResource(target.definition) &&
    !definitions.some((item) => item.name === 'delete')
  ) {
    definitions.push(builtInActions.delete().definition)
  }
  return definitions
}

function render(ctx: HttpContext, props: object, component?: string) {
  return ctx.inertia.render((component ?? 'pupitre') as never, props as never)
}

async function relationPageProps(
  ctx: HttpContext,
  target: ResourceRuntime,
  parent: LucidRow,
  viewOnly: boolean
): Promise<{
  relations: RelationDescriptor[]
  extraProps: Record<string, unknown>
  deferred: string[]
}> {
  const managers = flattenRelationManagers(target.definition.relations)
  if (!managers.length) return { relations: [], extraProps: {}, deferred: [] }
  const canUpdate = await authorizeResource(ctx, target, 'update', parent)
  const relations = await Promise.all(
    managers.map((manager) =>
      compileRelationDescriptor(
        ctx,
        target,
        parent,
        manager,
        viewOnly || manager.readOnly || !canUpdate
      )
    )
  )
  const deferred = relations.map((relation) => relation.dataProp)
  const extraProps = Object.fromEntries(
    relations.map((relation, index) => [
      relation.dataProp,
      ctx.inertia.defer((() =>
        loadRelationTableData(
          ctx,
          target,
          parent,
          managers[index]!,
          relations[index]!.readOnly
        )) as never),
    ])
  )
  return { relations, extraProps, deferred }
}

function withRelationTabs(
  spec: JsonRenderSpec,
  state: unknown,
  relations: RelationDescriptor[],
  requested?: string
) {
  const elements = { ...spec.elements } as Record<string, unknown>
  const managerRoot = 'pupitre.relationManagers'
  const tabIds = relations.map((item) => `pupitre.relationManager.${item.key}`)
  elements[managerRoot] = {
    type: 'Tabs',
    props: {
      id: 'resource-relations',
      tabs: relations.map(({ key, label, group, icon, badge }) => ({
        key,
        label: group ? `${group} / ${label}` : label,
        ...(icon ? { icon } : {}),
        ...(badge !== undefined ? { badge } : {}),
      })),
      active: { $bindState: '/ui/tabs/resource-relations' },
    },
    children: tabIds,
  }
  for (const relation of relations) {
    const tabId = `pupitre.relationManager.${relation.key}`
    const managerId = `${tabId}.component`
    elements[tabId] = {
      type: 'Tab',
      props: { key: relation.key, label: relation.label },
      children: [managerId],
    }
    elements[managerId] = { type: 'RelationManager', props: { descriptor: relation } }
  }
  const root = 'pupitre.relationManagers.root'
  elements[root] = {
    type: 'Group',
    props: {},
    children: [spec.root, managerRoot],
  }
  const currentState = state && typeof state === 'object' ? (state as Record<string, unknown>) : {}
  const ui =
    currentState.ui && typeof currentState.ui === 'object'
      ? (currentState.ui as Record<string, unknown>)
      : {}
  const tabs = ui.tabs && typeof ui.tabs === 'object' ? (ui.tabs as Record<string, unknown>) : {}
  const active = relations.some((relation) => relation.key === requested)
    ? requested
    : relations[0]?.key
  return {
    spec: { ...spec, root, elements } as JsonRenderSpec,
    state: {
      ...currentState,
      ui: { ...ui, tabs: { ...tabs, 'resource-relations': active } },
    },
  }
}
export default class ResourceController {
  async list(ctx: HttpContext) {
    const target = await resource(ctx)

    await ensureAuthorized(ctx, target, 'viewAny')
    const table = target.definition.table
    if (!table) return ctx.response.notFound()
    const headerActions = await compileActions(ctx, target, headerDefinitions(target, 'list'))
    const bulkActions = await compileActions(ctx, target, target.definition.actions?.bulk ?? [])
    const definition = target.definition
    const pageConfig = definition.pages.list
    const descriptor = await compileTable(table, {
      url: target.urls.list,
      id: `${ctx.pupitre.panel.id}.${target.slug}`,
      tabs: pageConfig?.tabs,
      bulkActions,
      emptyStateAction: headerActions.find((action) => action.name === 'create'),
      compileFilterForm: async (nodes) => {
        const compiled = await compileForm([...nodes], {
          ...(await schemaContext(ctx, target, 'filters')),
          form: { method: 'get', url: target.urls.list, submitLabel: 'Apply', dirtyGuard: false },
        })
        return compiled.spec
      },
    })
    descriptor.realtime = await resourceRealtime(ctx, target.slug)
    const spec = {
      root: 'table',
      elements: { table: { type: 'DataTable', props: { descriptor } } },
    } as JsonRenderSpec
    const loadData = async () => {
      const queryParams = ctx.request.qs()
      const tableParams = parseTableParams(queryParams)
      const filters =
        tableParams.filters && typeof tableParams.filters === 'object'
          ? (tableParams.filters as Record<string, unknown>)
          : {}
      const trashedMode =
        filters.trashed === 'only' ? 'only' : filters.trashed === 'with' ? 'with' : undefined
      const scopedListQuery = scopedQuery(ctx, target, { trashed: trashedMode })
      const preloaded = new Set<string>()
      for (const column of table.columns) {
        if (column.kind === 'fragment') continue
        if (column.countRelation) {
          const relation = column.countRelation
          const alias = `${relation}_count`
          scopedListQuery.withCount(
            relation as never,
            (countQuery: { as(name: string): unknown }) => countQuery.as(alias)
          )
        }
        if (!column.name.includes('.')) continue
        const relation = column.name.split('.')[0]!
        if (!preloaded.has(relation) && target.model.$getRelation(relation)) {
          scopedListQuery.preload(relation as never)
          preloaded.add(relation)
        }
      }
      const queryResult = applyTableQuery(scopedListQuery, table, ctx.request.qs(), {
        ctx,
        tabs: pageConfig?.tabs,
      })
      const summaryResult = table.columns.some(
        (column) => column.kind !== 'fragment' && column.summaries?.length
      )
        ? await aggregateTableSummaries(queryResult.query, table, {
            locale: ctx.pupitre.locale,
            timezone: ctx.pupitre.timezone,
            normalized: queryResult.normalized,
          })
        : undefined
      let rows: LucidRow[]
      let meta: {
        total: number
        perPage: number
        currentPage: number
        lastPage: number
        from: number
        to: number
      }
      if (queryResult.perPage === 'all') {
        rows = await queryResult.query.exec()
        meta = {
          total: rows.length,
          perPage: rows.length || 1,
          currentPage: 1,
          lastPage: 1,
          from: rows.length ? 1 : 0,
          to: rows.length,
        }
      } else {
        const paginated = (await queryResult.query.paginate(
          queryResult.page,
          queryResult.perPage
        )) as ModelPaginatorContract<LucidRow>
        rows = paginated.all()
        meta = paginated.getMeta()
      }
      const rowUrls = new Map<LucidRow, string>()
      for (const record of rows) {
        const id = recordValue(record, keyName(target.model)) as string | number
        if (target.definition.pages.view && (await authorizeResource(ctx, target, 'view', record)))
          rowUrls.set(record, target.urls.view(id))
        else if (
          target.definition.pages.edit &&
          (await authorizeResource(ctx, target, 'update', record))
        )
          rowUrls.set(record, target.urls.edit(id))
      }
      const rowActions = [...(definition.actions?.row ?? [])]
      if (pageConfig?.modals && !rowActions.some((item) => item.name === 'edit'))
        rowActions.push(builtInActions.edit().definition)
      const data = await buildTableData(table, rows, meta, {
        ctx,
        locale: ctx.pupitre.locale,
        timezone: ctx.pupitre.timezone,
        normalized: queryResult.normalized,
        ...(summaryResult?.summary ? { summary: summaryResult.summary } : {}),
        ...(summaryResult?.groups ? { groupSummaries: summaryResult.groups } : {}),
        rowUrl: (record) => rowUrls.get(record),
        rowActions: (record) => compileActions(ctx, target, rowActions, record, true),
        resolveFileUrl: (key, column) => {
          const field =
            column.kind === 'fragment'
              ? undefined
              : findUploadField(target.definition.form, column.name)
          return field ? resolveFileUrl(key, field) : Promise.resolve(key)
        },
      })
      return table.deferLoading ? tableDataSchema.parse(data) : data
    }
    const data = table.deferLoading
      ? // Lucid table cells are typed as unknown; loadData validates the deferred response with the wire schema.
        (ctx.inertia.defer(loadData as never) as unknown as TableData)
      : await loadData()
    const context = { resource: target.slug, widgetPage: 'list' as const }
    const headerWidgets = await prepareWidgets(
      ctx,
      pageConfig?.widgets ?? [],
      undefined,
      'header',
      context
    )
    const footerWidgets = await prepareWidgets(
      ctx,
      pageConfig?.footerWidgets ?? [],
      undefined,
      'footer',
      context
    )
    return render(
      ctx,
      buildPageProps({
        ctx,
        resource: target,
        parentBreadcrumb: nestedParentBreadcrumb(ctx, target),
        kind: 'list',
        spec,
        state: {},
        title: target.pluralLabel,
        headerActions,
        data,
        widgets: [...headerWidgets.widgets, ...footerWidgets.widgets],
        deferred: [...headerWidgets.deferred, ...footerWidgets.deferred],
        extraProps: { ...headerWidgets.extraProps, ...footerWidgets.extraProps },
      }),
      pageConfig?.component
    )
  }

  async create(ctx: HttpContext) {
    const target = await resource(ctx)
    await authorizeNestedMutation(ctx, target)
    await ensureAuthorized(ctx, target, 'create')
    const pageConfig = target.definition.pages.create
    if (!pageConfig || !target.definition.form) return ctx.response.notFound()
    const compiled = await compileForm(target.definition.form, {
      ...(await schemaContext(ctx, target, 'create')),
      form: {
        method: 'post',
        url: target.urls.list,
        submitLabel: `Create ${target.label}`,
        cancelUrl: target.urls.list,
        dirtyGuard: true,
      },
    })
    const actions = await compileActions(ctx, target, target.definition.actions?.header ?? [])
    const widgetProps = await pageWidgets(ctx, target, 'create')
    return render(
      ctx,
      buildPageProps({
        ctx,
        resource: target,
        parentBreadcrumb: nestedParentBreadcrumb(ctx, target),
        kind: 'create',
        spec: compiled.spec,
        state: compiled.state,
        title: `Create ${target.label}`,
        headerActions: actions,
        widgets: widgetProps.widgets,
        deferred: widgetProps.deferred,
        extraProps: widgetProps.extraProps,
      }),
      pageConfig.component
    )
  }

  async edit(ctx: HttpContext) {
    const target = await resource(ctx)
    await authorizeNestedMutation(ctx, target)
    await ensureAuthorized(ctx, target, 'viewAny')
    const record = await findRecord(ctx, target)
    if (!record) return ctx.response.notFound()
    await ensureAuthorized(ctx, target, 'update', record)
    const pageConfig = target.definition.pages.edit
    if (!pageConfig || !target.definition.form) return ctx.response.notFound()
    const data = (await target.definition.hooks.fill?.(record, ctx)) ?? serialized(record)
    await fillRelationshipRepeaters(target, record, data)
    const compiled = await compileForm(target.definition.form, {
      ...(await schemaContext(ctx, target, 'edit', record)),
      form: {
        method: 'put',
        url: target.urls.update(recordValue(record, keyName(target.model)) as string | number),
        submitLabel: 'Save',
        cancelUrl: target.urls.list,
        dirtyGuard: true,
      },
      data,
    })
    const relationProps = await relationPageProps(ctx, target, record, false)
    const composed = relationProps.relations.length
      ? withRelationTabs(
          compiled.spec,
          compiled.state,
          relationProps.relations,
          typeof ctx.request.qs().relation === 'string' ? ctx.request.qs().relation : undefined
        )
      : { spec: compiled.spec, state: compiled.state }
    const actions = await compileActions(ctx, target, headerDefinitions(target, 'edit'), record)
    const id = recordValue(record, keyName(target.model)) as string | number
    const widgetProps = await pageWidgets(ctx, target, 'edit', record)
    return render(
      ctx,
      buildPageProps({
        ctx,
        resource: target,
        parentBreadcrumb: nestedParentBreadcrumb(ctx, target),
        kind: 'edit',
        spec: composed.spec,
        state: composed.state,
        title: String(data[target.definition.recordTitle ?? keyName(target.model)] ?? target.label),
        recordId: id,
        recordLabel: String(
          data[target.definition.recordTitle ?? keyName(target.model)] ?? target.label
        ),
        headerActions: actions,
        widgets: widgetProps.widgets,
        relations: relationProps.relations,
        subNavigation: resourceSubNavigation(ctx, target, 'edit', id, relationProps.relations),
        extraProps: { ...relationProps.extraProps, ...widgetProps.extraProps },
        deferred: [...relationProps.deferred, ...widgetProps.deferred],
      }),
      pageConfig.component
    )
  }

  async view(ctx: HttpContext) {
    const target = await resource(ctx)
    await ensureAuthorized(ctx, target, 'viewAny')
    const record = await findRecord(ctx, target)
    if (!record) return ctx.response.notFound()
    await ensureAuthorized(ctx, target, 'view', record)
    const nodes = target.definition.infolist ?? []
    const compiled = await compileInfolist(nodes, await schemaContext(ctx, target, 'view', record))
    const relationProps = await relationPageProps(ctx, target, record, true)
    const composed = relationProps.relations.length
      ? withRelationTabs(
          compiled.spec,
          compiled.state,
          relationProps.relations,
          typeof ctx.request.qs().relation === 'string' ? ctx.request.qs().relation : undefined
        )
      : { spec: compiled.spec, state: compiled.state }
    const actions = await compileActions(ctx, target, headerDefinitions(target, 'view'), record)
    const id = recordValue(record, keyName(target.model)) as string | number
    const widgetProps = await pageWidgets(ctx, target, 'view', record)
    return render(
      ctx,
      buildPageProps({
        ctx,
        resource: target,
        parentBreadcrumb: nestedParentBreadcrumb(ctx, target),
        kind: 'view',
        spec: composed.spec,
        state: composed.state,
        title: String(
          recordValue(record, target.definition.recordTitle ?? keyName(target.model)) ??
            target.label
        ),
        recordId: id,
        recordLabel: String(
          recordValue(record, target.definition.recordTitle ?? keyName(target.model)) ??
            target.label
        ),
        headerActions: actions,
        widgets: widgetProps.widgets,
        relations: relationProps.relations,
        subNavigation: resourceSubNavigation(ctx, target, 'view', id, relationProps.relations),
        extraProps: { ...relationProps.extraProps, ...widgetProps.extraProps },
        deferred: [...relationProps.deferred, ...widgetProps.deferred],
      }),
      target.definition.pages.view?.component
    )
  }

  async store(ctx: HttpContext) {
    const target = await resource(ctx)
    await authorizeNestedMutation(ctx, target)
    await ensureAuthorized(ctx, target, 'create')
    if (!target.definition.form) return ctx.response.notFound()
    let validated: Record<string, unknown>
    try {
      validated = await validateResourceData(
        ctx,
        target.model,
        target.definition.form,
        ctx.request.all()
      )
    } catch (error) {
      if (handleActionValidation(ctx, error)) return
      throw error
    }
    const saved = await target.model.transaction(async (trx) => {
      let data =
        (await target.definition.hooks.mutateBeforeCreate?.(validated, ctx, trx)) ?? validated
      data = (await target.definition.hooks.mutateBeforeSave?.(data, null, ctx, trx)) ?? data
      await target.definition.hooks.beforeCreate?.(data, ctx, trx)
      await target.definition.hooks.beforeSave?.(null, data, ctx, trx)
      // Ownership is applied last so before hooks cannot move a record to another tenant.
      data = fillTenantOwnership(ctx, target, data)
      data = applyNestedOwnership(ctx, target, data)
      const attributes = resourceAttributes(target.definition.form ?? [], data)
      const record = target.definition.handlers.create
        ? await target.definition.handlers.create(attributes, ctx, trx)
        : await target.model.create(attributes, { client: trx })
      ;(record as LucidRow).useTransaction(trx)
      await syncRelationshipRepeaters(target, record as LucidRow, data, trx)
      await target.definition.hooks.afterCreate?.(record, ctx, trx)
      await target.definition.hooks.afterSave?.(record, ctx, trx)
      return record
    })
    await publishResourceChange(ctx, target.slug)
    const submittedRichEditorFields = new Set(
      richEditorFieldNames(target.definition.form).filter((field) =>
        valuesAt(validated, field).some((value) => value !== undefined)
      )
    )
    pruneUploads(
      ctx,
      target.slug,
      consumedUploads(uploadFields(target.definition.form), validated),
      submittedRichEditorFields
    )
    const redirectTo = target.definition.pages.create?.redirectTo ?? 'edit'
    const savedId = recordValue(saved, keyName(target.model)) as string | number
    const redirect =
      redirectTo === 'list'
        ? target.urls.list
        : redirectTo === 'view'
          ? target.urls.view(savedId)
          : target.urls.edit(savedId)
    const flash = [{ type: 'success' as const, title: 'Created' }]
    setRedirectFlash(ctx, flash)
    if (isPupitreActionRequest(ctx)) return actionJson(ctx, { flash, redirect })
    return ctx.response.redirect(redirect)
  }

  async update(ctx: HttpContext) {
    const target = await resource(ctx)
    await ensureAuthorized(ctx, target, 'viewAny')
    await authorizeNestedMutation(ctx, target)
    const record = await findRecord(ctx, target)
    if (!record) return ctx.response.notFound()
    await ensureAuthorized(ctx, target, 'update', record)
    if (!target.definition.form) return ctx.response.notFound()
    let validated: Record<string, unknown>
    try {
      validated = await validateResourceData(
        ctx,
        target.model,
        target.definition.form,
        ctx.request.all(),
        record
      )
    } catch (error) {
      if (handleActionValidation(ctx, error)) return
      throw error
    }
    const fileFields = uploadFields(target.definition.form)
    const oldValues = new Map(
      fileFields.map((field) => [field.name, valuesAt(serialized(record), field.name)])
    )
    let savedRecord = record
    await target.model.transaction(async (trx) => {
      let data =
        (await target.definition.hooks.mutateBeforeSave?.(validated, record, ctx, trx)) ?? validated
      data = applyNestedOwnership(ctx, target, data)
      const attributes = resourceAttributes(target.definition.form ?? [], data)
      const ownership = ctx.pupitre.panel.tenancy?.ownership
      if (ownership) {
        const ownershipAttribute =
          target.model.$keys.columnsToAttributes.get(ownership) ?? ownership
        delete attributes[ownershipAttribute]
      }
      await target.definition.hooks.beforeSave?.(record, data, ctx, trx)
      record.useTransaction(trx)
      savedRecord = target.definition.handlers.update
        ? ((await target.definition.handlers.update(record, attributes, ctx, trx)) as LucidRow)
        : ((await record.merge(attributes).save()) as LucidRow)
      savedRecord.useTransaction(trx)
      await syncRelationshipRepeaters(target, savedRecord, data, trx)
      await target.definition.hooks.afterSave?.(savedRecord, ctx, trx)
    })
    await publishResourceChange(ctx, target.slug)
    const submittedRichEditorFields = new Set(
      richEditorFieldNames(target.definition.form).filter((field) =>
        valuesAt(validated, field).some((value) => value !== undefined)
      )
    )
    pruneUploads(
      ctx,
      target.slug,
      consumedUploads(fileFields, validated),
      submittedRichEditorFields
    )
    for (const field of fileFields) {
      await cleanupReplacedFiles(
        field,
        oldValues.get(field.name),
        serializedValue(savedRecord, field.name)
      )
    }
    const flash = [{ type: 'success' as const, title: 'Saved' }]
    setRedirectFlash(ctx, flash)
    if (isPupitreActionRequest(ctx))
      return actionJson(ctx, { flash, redirect: target.urls.edit(ctx.params.id) })
    return ctx.response.redirect(target.urls.edit(ctx.params.id))
  }

  async updateColumn(ctx: HttpContext) {
    const target = await resource(ctx)
    await ensureAuthorized(ctx, target, 'viewAny')
    await authorizeNestedMutation(ctx, target)
    const record = await findRecord(ctx, target)
    if (!record) return ctx.response.notFound()
    await ensureAuthorized(ctx, target, 'update', record)
    const column = target.definition.table?.columns.find(
      (candidate) => candidate.kind !== 'fragment' && candidate.name === ctx.params.name
    )
    if (!column || !('editable' in column && column.editable)) return ctx.response.notFound()
    if (typeof column.disabled === 'function' && column.disabled({ record: serialized(record) }))
      return ctx.response.forbidden()
    const body = ctx.request.all()
    if (!Object.hasOwn(body, 'value') || Object.keys(body).some((key) => key !== 'value')) {
      return ctx.response.badRequest()
    }
    const value = body.value
    const invalid =
      (column.kind === 'toggle' || column.kind === 'checkbox') && typeof value !== 'boolean'
        ? 'Value must be a boolean'
        : column.kind === 'select' &&
            (!Object.hasOwn(column.options ?? {}, String(value)) || typeof value !== 'string')
          ? 'Value is not an available option'
          : column.kind === 'textInput' && typeof value !== 'string'
            ? 'Value must be text'
            : undefined
    if (invalid) return ctx.response.unprocessableEntity({ errors: { value: [invalid] } })
    if (column.kind === 'textInput' && column.validation) {
      try {
        await compileValidator([
          { kind: 'text', name: 'value', rules: column.validation } as FieldDefinitionUnion,
        ]).validate({ value }, { record, model: target.model, ctx, timezone: ctx.pupitre.timezone })
      } catch (error) {
        const validationErrors: Record<string, string[]> = { value: ['Invalid value'] }
        if (
          error &&
          typeof error === 'object' &&
          'messages' in error &&
          Array.isArray(error.messages)
        ) {
          validationErrors.value = error.messages.map((message) =>
            message && typeof message === 'object' && 'message' in message
              ? String(message.message)
              : String(message)
          )
        }
        return ctx.response.unprocessableEntity({ errors: validationErrors })
      }
    }
    try {
      await target.model.transaction(async (trx) => {
        record.useTransaction(trx)
        await record.merge({ [column.name]: value }).save()
      })
    } catch (error) {
      const errors: Record<string, string[]> = { value: ['Unable to save this value'] }
      if (
        error &&
        typeof error === 'object' &&
        'messages' in error &&
        Array.isArray(error.messages)
      ) {
        errors.value = error.messages.map((message) =>
          message && typeof message === 'object' && 'message' in message
            ? String(message.message)
            : String(message)
        )
      }
      return ctx.response.unprocessableEntity({ errors })
    }
    await publishResourceChange(ctx, target.slug)
    return ctx.response.noContent()
  }

  async reorder(ctx: HttpContext) {
    const target = await resource(ctx)
    await authorizeNestedMutation(ctx, target)
    await ensureAuthorized(ctx, target, 'viewAny')
    const column = target.definition.table?.reorderable
    if (!column) return ctx.response.notFound()
    const { ids, offset } = ctx.request.all() as { ids?: unknown; offset?: unknown }
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.some((id) => !['string', 'number'].includes(typeof id)) ||
      new Set(ids).size !== ids.length ||
      (offset !== undefined && (!Number.isSafeInteger(offset) || Number(offset) < 0))
    )
      return ctx.response.badRequest()
    const startIndex = typeof offset === 'number' ? offset : 0
    const records = await scopedQuery(ctx, target).whereIn(keyName(target.model), ids as never[])
    if (records.length !== ids.length) return ctx.response.notFound()
    for (const record of records) {
      await ensureAuthorized(ctx, target, 'reorder', record)
    }
    await target.model.transaction(async (trx) => {
      const byId = new Map(
        records.map((record) => [String(recordValue(record, keyName(target.model))), record])
      )
      for (const [index, id] of ids.entries()) {
        const record = byId.get(String(id))
        if (!record) return
        record.useTransaction(trx)
        await record.merge({ [column]: startIndex + index }).save()
      }
    })
    await publishResourceChange(ctx, target.slug)
    return ctx.response.noContent()
  }

  async destroy(ctx: HttpContext) {
    const target = await resource(ctx)
    await ensureAuthorized(ctx, target, 'viewAny')
    await authorizeNestedMutation(ctx, target)
    const record = await findRecord(ctx, target)
    if (!record) return ctx.response.notFound()
    await ensureAuthorized(ctx, target, 'delete', record)
    await executeBuiltinDelete(target.definition, [record], ctx)
    await publishResourceChange(ctx, target.slug)
    const flash = [{ type: 'success' as const, title: 'Deleted' }]
    setRedirectFlash(ctx, flash)
    if (isPupitreActionRequest(ctx))
      return actionJson(ctx, { flash, redirect: target.urls.list, deselect: true })
    return ctx.response.redirect(target.urls.list)
  }
}
