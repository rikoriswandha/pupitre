import { prepareTableViews } from '../../table/views/controller.js'
import { t } from '../../i18n.js'
import { publishResourceChange, resourceRealtime } from '../../realtime.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type {
  ActionDescriptor,
  JsonRenderSpec,
  RelationDescriptor,
  TableData,
} from '../../../catalog/wire.js'
import type { ResourceRuntime } from '../../manager.js'
import type { RelationManagerDefinition } from '../../definition/relation_manager.js'
import type { ActionDefinition } from '../../definition/action.js'
import { flattenRelationManagers } from '../../definition/relation_manager.js'
import { compileTable } from '../../compiler/table_compiler.js'
import {
  compileActionForm,
  compileActionDescriptor,
  executeAction,
  executeBuiltinDelete,
} from '../../compiler/action_compiler.js'
import { applyTableQuery, parseTableParams } from '../../query/table_query.js'
import { buildTableData } from '../../table/table_data.js'
import { authorizeModel, ensureAuthorized } from '../../authz/bouncer.js'
import { requestResource, scopedQuery } from '../../query/scoped_query.js'
import { errorJson, actionJson } from '../responses.js'
import { currentPageUrl } from '../return_url.js'
import { cleanupRecordFiles } from '../../storage/record_files.js'
import { compileForm } from '../../compiler/schema_compiler.js'
import { actions as builtins } from '../../builder/action.js'
import { schema as schemaFactory, getComponentDefinition } from '../../builder/schema/schema.js'
import { validateResourceData } from '../validation.js'
import { E_PUPITRE_FORBIDDEN } from '../../errors.js'
import { applyRelatedScope, fillRelatedOwnership } from '../../tenancy/related.js'
import { lookupOrNull } from '../../query/record_lookup.js'
import { consumeFormUploads } from '../../storage/upload_tracking.js'

async function resource(ctx: HttpContext): Promise<ResourceRuntime | undefined> {
  const target = requestResource(ctx, ctx.params.slug)
  if (!target?.parent) return target
  const parent = requestResource(ctx, target.parent.resource)
  if (!parent) return undefined
  await ensureAuthorized(ctx, parent, 'viewAny')
  const parentId = ctx.params[target.parent.param]
  const record = await lookupOrNull(() =>
    scopedQuery(ctx, parent).where(keyName(parent.model), parentId).first()
  )
  if (!record) return undefined
  await ensureAuthorized(ctx, parent, 'view', record)
  return target
}

async function ensureNestedParentUpdate(ctx: HttpContext, target: ResourceRuntime) {
  if (!target.parent) return
  const parent = requestResource(ctx, target.parent.resource)
  if (!parent) throw new E_PUPITRE_FORBIDDEN()
  const parentId = ctx.params[target.parent.param]
  const record = await lookupOrNull(() =>
    scopedQuery(ctx, parent).where(keyName(parent.model), parentId).first()
  )
  if (!record) return
  await ensureAuthorized(ctx, parent, 'update', record)
}

function keyName(model: LucidModel): string {
  return (model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
}

function relationDefinition(
  target: ResourceRuntime,
  name: string
): RelationManagerDefinition | undefined {
  return flattenRelationManagers(target.definition.relations).find((item) => item.relation === name)
}

function relatedModel(target: ResourceRuntime, manager: RelationManagerDefinition): LucidModel {
  const relation = target.model.$getRelation(manager.relation)
  relation.boot()
  return relation.relatedModel() as LucidModel
}
function relationUrl(
  target: ResourceRuntime,
  manager: RelationManagerDefinition,
  parent: LucidRow
): string {
  const id = parent.$getAttribute(keyName(target.model)) as string | number
  return `${target.urls.list}/${encodeURIComponent(String(id))}/relations/${encodeURIComponent(manager.relation)}`
}
type RelationClient = {
  query(): ModelQueryBuilderContract<LucidModel>
  create(data: Record<string, unknown>): Promise<LucidRow>
  attach(ids: (string | number)[] | Record<string, Record<string, unknown>>): Promise<void>
  detach(ids: (string | number)[]): Promise<void>
}

function relationClient(parent: LucidRow, name: string): RelationClient {
  const row = parent as unknown as { related(relation: string): RelationClient }
  return row.related(name)
}
async function parentRecord(ctx: HttpContext, target: ResourceRuntime): Promise<LucidRow | null> {
  await ensureModelAbility(ctx, target.model, 'viewAny')
  return lookupOrNull(() =>
    scopedQuery(ctx, target).where(keyName(target.model), ctx.params.id).first()
  )
}

async function ensureModelAbility(
  ctx: HttpContext,
  model: LucidModel,
  ability: string,
  record?: LucidRow
) {
  if (!(await authorizeModel(ctx, model, ability, record))) throw new E_PUPITRE_FORBIDDEN()
}

async function relatedQuery(
  ctx: HttpContext,
  target: ResourceRuntime,
  parent: LucidRow,
  manager: RelationManagerDefinition,
  options: { trashed?: 'with' | 'only' } = {}
) {
  const model = relatedModel(target, manager)
  const relatedResource = ctx.pupitre.panel.resources.find((item) => item.model === model)
  const query = relationClient(parent, manager.relation).query()
  const scopeContext = relatedResource?.parent
    ? Object.assign(Object.create(ctx) as HttpContext, {
        params: {
          ...ctx.params,
          [relatedResource.parent.param]:
            relatedResource.parent.resource === target.slug ? parent.$primaryKeyValue : undefined,
        },
      })
    : ctx
  await applyRelatedScope(scopeContext, model, query, relatedResource, options)
  return { model, query, relatedResource }
}

function relationActions(manager: RelationManagerDefinition, relationType: string) {
  const actions: { header: ActionDefinition[]; row: ActionDefinition[]; bulk: ActionDefinition[] } =
    {
      header: [...manager.actions.header],
      row: [...manager.actions.row],
      bulk: [...manager.actions.bulk],
    }
  const add = (group: keyof typeof actions, action: ActionDefinition) => {
    if (!actions[group].some((item) => item.name === action.name)) actions[group].push(action)
  }
  if (relationType === 'manyToMany') {
    add('header', builtins.attach().definition)
    add('row', builtins.detach().definition)
    add('bulk', builtins.bulkDetach().definition)
  } else {
    add('header', builtins.create().definition)
    add('header', builtins.associate().definition)
    add('row', builtins.edit().definition)
    add('row', builtins.view().definition)
    add('row', builtins.delete().definition)
    add('row', builtins.dissociate().definition)
    add('bulk', builtins.bulkDissociate().definition)
  }
  return actions
}
function relationActionForm(
  ctx: HttpContext,
  manager: RelationManagerDefinition,
  action: ActionDefinition,
  model: LucidModel
) {
  if (action.form) return [...action.form]
  if (action.builtin === 'create' || action.builtin === 'edit' || action.builtin === 'view')
    return (
      manager.form ??
      ctx.pupitre.panel.resources.find((item) => item.model === model)?.definition.form
    )
  if (action.builtin !== 'attach' && action.builtin !== 'associate') return undefined
  const idsField = getComponentDefinition(schemaFactory.multiSelect('ids').options({}).searchable())
  return [idsField, ...(action.builtin === 'attach' ? (manager.form ?? []) : [])]
}

function actionUrl(base: string, name: string, id?: string | number) {
  return `${base}${id === undefined ? '' : `/${encodeURIComponent(String(id))}`}/actions/${encodeURIComponent(name)}`
}

async function compileRelationActions(
  ctx: HttpContext,
  target: ResourceRuntime,
  manager: RelationManagerDefinition,
  parent: LucidRow,
  related: LucidModel,
  group: ActionDefinition[],
  record?: LucidRow,
  readOnly = false
): Promise<ActionDescriptor[]> {
  const baseUrl = relationUrl(target, manager, parent)
  const relatedResource = ctx.pupitre.panel.resources.find((item) => item.model === related)
  const id = record?.$getAttribute(keyName(related)) as string | number | undefined
  const actions: ActionDescriptor[] = await Promise.all(
    group.map(async (action): Promise<ActionDescriptor> => {
      const descriptor = await compileActionDescriptor(action, {
        baseUrl,
        ...(record ? { record, recordKey: id } : {}),
        ctx,
        authorize: (ability, row) => authorizeModel(ctx, related, ability, row),
        routes: {
          list: baseUrl,
          create: actionUrl(baseUrl, action.name),
          edit: (recordId) => actionUrl(baseUrl, action.name, recordId),
          view: (recordId) => actionUrl(baseUrl, action.name, recordId),
          destroy: (recordId) => actionUrl(baseUrl, action.name, recordId),
        },
        resourceLabel: manager.label,
      })
      if (readOnly && action.builtin !== 'view') return { ...descriptor, enabled: false }
      if (action.builtin === 'view' && relatedResource && id !== undefined)
        return {
          ...descriptor,
          kind: 'link' as const,
          method: 'get' as const,
          url: relatedResource.urls.view(id),
        }
      if (
        action.builtin === 'create' ||
        action.builtin === 'attach' ||
        action.builtin === 'associate' ||
        (action.builtin === 'edit' && (manager.form || relatedResource?.definition.form))
      )
        return {
          ...descriptor,
          kind: 'form' as const,
          method: 'post' as const,
          url: actionUrl(
            baseUrl,
            action.name,
            action.builtin === 'create' ||
              action.builtin === 'attach' ||
              action.builtin === 'associate'
              ? undefined
              : id
          ),
        }
      return descriptor
    })
  )
  return actions
}

export async function compileRelationDescriptor(
  ctx: HttpContext,
  target: ResourceRuntime,
  parent: LucidRow,
  manager: RelationManagerDefinition,
  readOnly: boolean
): Promise<RelationDescriptor> {
  const related = relatedModel(target, manager)
  if (!(await authorizeModel(ctx, related, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
  const relation = target.model.$getRelation(manager.relation)
  const actions = relationActions(manager, relation.type)
  const baseUrl = relationUrl(target, manager, parent)
  const dataProp = `${manager.relation}Data`
  const header = await compileRelationActions(
    ctx,
    target,
    manager,
    parent,
    related,
    actions.header,
    undefined,
    readOnly
  )
  const bulk = await compileRelationActions(
    ctx,
    target,
    manager,
    parent,
    related,
    actions.bulk,
    undefined,
    readOnly
  )
  const table = await compileTable(
    manager.table ?? {
      columns: [],
      filters: [],
      filtersLayout: 'dropdown',
      searchDebounce: 300,
      paginated: [10, 25, 50],
      striped: false,
    },
    {
      id: `${ctx.pupitre.panel.id}.${target.slug}.${manager.relation}`,
      url: baseUrl,
      dataProp,
      queryPrefix: manager.relation,
      bulkActions: bulk,
      compileFilterForm: async (nodes) => {
        const compiled = await compileForm([...nodes], {
          ctx,
          locale: ctx.pupitre.locale,
          timezone: ctx.pupitre.timezone,
          form: { method: 'get', url: baseUrl, submitLabel: t('Apply'), dirtyGuard: false },
        })
        return compiled.spec
      },
    }
  )
  if (manager.table) await prepareTableViews(ctx, target, manager.table, table, related)
  if (manager.table?.poll) table.realtime = await resourceRealtime(ctx, target.slug)
  const badge = manager.badge ? await manager.badge(ctx, parent) : undefined
  return {
    key: manager.relation,
    relation: manager.relation,
    label: manager.label,
    ...(manager.group ? { group: manager.group } : {}),
    ...(manager.icon ? { icon: manager.icon } : {}),
    ...(typeof badge === 'string' || typeof badge === 'number' ? { badge } : {}),
    url: baseUrl,
    dataProp,
    queryPrefix: manager.relation,
    readOnly,
    table,
    actions: { header, row: [], bulk },
  }
}

export async function loadRelationTableData(
  ctx: HttpContext,
  target: ResourceRuntime,
  parent: LucidRow,
  manager: RelationManagerDefinition,
  readOnly = manager.readOnly
): Promise<TableData> {
  const table = manager.table ?? {
    columns: [],
    filters: [],
    filtersLayout: 'dropdown' as const,
    searchDebounce: 300,
    paginated: [10, 25, 50] as const,
    striped: false,
  }
  const params = parseTableParams(ctx.request.qs(), manager.relation)
  const filters =
    params.filters && typeof params.filters === 'object'
      ? (params.filters as Record<string, unknown>)
      : {}
  const trashed =
    filters.trashed === 'only' ? 'only' : filters.trashed === 'with' ? 'with' : undefined
  const { model, query } = await relatedQuery(ctx, target, parent, manager, { trashed })
  const result = applyTableQuery(query as never, table, ctx.request.qs(), {
    ctx,
    prefix: manager.relation,
  })
  let rows: LucidRow[]
  if (!(await authorizeModel(ctx, model, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
  let meta: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
    from: number
    to: number
  }
  if (result.perPage === 'all') {
    rows = await result.query.exec()
    meta = {
      total: rows.length,
      perPage: rows.length || 1,
      currentPage: 1,
      lastPage: 1,
      from: rows.length ? 1 : 0,
      to: rows.length,
    }
  } else {
    const paginator = (await result.query.paginate(
      result.page,
      result.perPage
    )) as ModelPaginatorContract<LucidRow>
    rows = paginator.all()
    meta = paginator.getMeta()
  }
  const relation = target.model.$getRelation(manager.relation)
  const actions = relationActions(manager, relation.type)
  return buildTableData(table, rows, meta, {
    ctx,
    locale: ctx.pupitre.locale,
    timezone: ctx.pupitre.timezone,
    normalized: result.normalized,
    rowUrl: () => undefined,
    rowActions: (record) =>
      compileRelationActions(ctx, target, manager, parent, model, actions.row, record, readOnly),
  })
}

export default class RelationController {
  async list(ctx: HttpContext) {
    const target = await resource(ctx)
    if (!target) return errorJson(ctx, t('Resource not found'), 404)
    const manager = relationDefinition(target, ctx.params.relation)
    if (!manager) return errorJson(ctx, t('Relation not found'), 404)
    const parent = await parentRecord(ctx, target)
    if (!parent) return errorJson(ctx, t('Record not found'), 404)
    await ensureModelAbility(ctx, target.model, 'view', parent)
    const readOnly =
      manager.readOnly || !(await authorizeModel(ctx, target.model, 'update', parent))
    const data = await loadRelationTableData(ctx, target, parent, manager, readOnly)
    return ctx.response.ok(data)
  }

  async showAction(ctx: HttpContext) {
    const target = await resource(ctx)
    if (!target) return errorJson(ctx, t('Resource not found'), 404)
    const manager = relationDefinition(target, ctx.params.relation)
    if (!manager) return errorJson(ctx, t('Relation not found'), 404)
    const parent = await parentRecord(ctx, target)
    if (!parent) return errorJson(ctx, t('Record not found'), 404)
    await ensureNestedParentUpdate(ctx, target)
    await ensureModelAbility(ctx, target.model, 'update', parent)
    const related = relatedModel(target, manager)
    await ensureModelAbility(ctx, related, 'viewAny')
    const actionGroups = relationActions(manager, target.model.$getRelation(manager.relation).type)
    const action = [...actionGroups.header, ...actionGroups.row, ...actionGroups.bulk].find(
      (item) => item.name === ctx.params.action
    )
    if (!action) return errorJson(ctx, t('Action not found'), 404)
    const baseUrl = relationUrl(target, manager, parent)
    const { query } = await relatedQuery(ctx, target, parent, manager)
    const record =
      ctx.params.rid === undefined
        ? undefined
        : await lookupOrNull(() => query.where(keyName(related), ctx.params.rid).first())
    if (ctx.params.rid !== undefined && !record) return errorJson(ctx, t('Record not found'), 404)
    if ((!action.builtin || action.builtin === 'bulk') && record)
      await ensureModelAbility(ctx, related, 'view', record)
    if (action.visible && !(await action.visible({ record: record ?? null, ctx })))
      throw new E_PUPITRE_FORBIDDEN()
    const nodes = relationActionForm(ctx, manager, action, related)
    if (!nodes) return errorJson(ctx, t('Action form not found'), 404)
    const ability =
      action.can ??
      (action.builtin === 'attach'
        ? 'attach'
        : action.builtin === 'associate'
          ? 'associate'
          : action.builtin === 'edit'
            ? 'update'
            : action.builtin === 'view'
              ? 'view'
              : action.builtin === 'delete'
                ? 'delete'
                : action.builtin === 'detach'
                  ? 'detach'
                  : action.builtin === 'dissociate'
                    ? 'dissociate'
                    : action.builtin === 'create'
                      ? 'create'
                      : undefined)
    if (
      ability &&
      (record || action.builtin === 'attach' || action.builtin === 'associate') &&
      !(await authorizeModel(ctx, related, ability, record ?? undefined))
    )
      return errorJson(ctx, t('You are not authorized to perform this action'), 403)
    const response = await compileActionForm(
      { ...action, form: nodes },
      {
        ctx,
        locale: ctx.pupitre.locale,
        timezone: ctx.pupitre.timezone,
        ...(record ? { model: record, record: record.serialize() as Record<string, unknown> } : {}),
        url: actionUrl(baseUrl, action.name, ctx.params.rid),
      }
    )
    if (action.builtin === 'attach' || action.builtin === 'associate') {
      const optionsUrl = `${actionUrl(baseUrl, action.name)}/options`
      const elements = { ...response.spec.elements }
      for (const [elementId, element] of Object.entries(elements)) {
        const entry = element as { props: Record<string, unknown> }
        if (entry.props.name !== 'ids') continue
        elements[elementId] = {
          ...element,
          props: { ...entry.props, optionsUrl, searchable: true, preload: false },
        }
      }
      response.spec = { ...response.spec, elements } as JsonRenderSpec
    }
    return ctx.response.ok(response)
  }
  async options(ctx: HttpContext) {
    const target = await resource(ctx)
    if (!target) return errorJson(ctx, t('Resource not found'), 404)
    const manager = relationDefinition(target, ctx.params.relation)
    if (!manager) return errorJson(ctx, t('Relation not found'), 404)
    const parent = await parentRecord(ctx, target)
    if (!parent) return errorJson(ctx, t('Record not found'), 404)
    await ensureNestedParentUpdate(ctx, target)
    await ensureModelAbility(ctx, target.model, 'update', parent)
    const related = relatedModel(target, manager)
    await ensureModelAbility(ctx, related, 'viewAny')
    const relatedResource = ctx.pupitre.panel.resources.find((item) => item.model === related)
    const action = ctx.params.action
    const relation = target.model.$getRelation(manager.relation)
    let query = related.query()
    await applyRelatedScope(ctx, related, query, relatedResource)
    if (action === 'associate' && relation.type === 'hasMany') {
      relation.boot()
      query = query.whereNull((relation as { foreignKey: string }).foreignKey)
    } else if (action === 'attach' && relation.type === 'manyToMany') {
      const attached = await relationClient(parent, manager.relation).query()
      const attachedIds = attached.map((row) => row.$getAttribute(keyName(related)))
      if (attachedIds.length) query = query.whereNotIn(keyName(related), attachedIds as never[])
    } else {
      return errorJson(ctx, t('Options are available only for attach/associate actions'), 404)
    }
    const title = manager.recordTitle ?? relatedResource?.definition.recordTitle ?? 'name'
    const rawSelected = ctx.request.qs().selected ?? ctx.request.qs()['selected[]']
    const selectedIds = (
      Array.isArray(rawSelected) ? rawSelected : rawSelected === undefined ? [] : [rawSelected]
    ).filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
    const selectedRows = selectedIds.length
      ? ((await lookupOrNull(() =>
          query.clone().whereIn(keyName(related), selectedIds as never[])
        )) ?? [])
      : []
    const search = ctx.request.qs().q
    const searchQuery = query.clone()
    if (typeof search === 'string' && search.trim())
      searchQuery.where(title, 'like', `%${search.trim()}%`)
    const pageValue = Number(ctx.request.qs().page)
    const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1
    const records = await searchQuery
      .orderBy(title)
      .offset((page - 1) * 20)
      .limit(21)
    const options = new Map<string, { value: string | number; label: string }>()
    for (const row of [...selectedRows, ...records.slice(0, 20)]) {
      const value = row.$getAttribute(keyName(related))
      if (typeof value !== 'string' && typeof value !== 'number') continue
      options.set(String(value), {
        value,
        label: String(row.$getAttribute(title) ?? value),
      })
    }
    return ctx.response.ok({
      options: [...options.values()],
      hasMore: records.length > 20,
    })
  }

  async runAction(ctx: HttpContext) {
    const target = await resource(ctx)
    if (!target) return errorJson(ctx, t('Resource not found'), 404)
    const manager = relationDefinition(target, ctx.params.relation)
    if (!manager) return errorJson(ctx, t('Relation not found'), 404)
    const parent = await parentRecord(ctx, target)
    if (!parent) return errorJson(ctx, t('Record not found'), 404)
    await ensureNestedParentUpdate(ctx, target)
    await ensureModelAbility(ctx, target.model, 'update', parent)
    if (manager.readOnly) return errorJson(ctx, t('Relation manager is read-only'), 403)
    const relation = target.model.$getRelation(manager.relation)
    const related = relation.relatedModel() as LucidModel
    const { query, relatedResource } = await relatedQuery(ctx, target, parent, manager)
    const actionName = ctx.params.action
    const defs = relationActions(manager, relation.type)
    const action = [...defs.header, ...defs.row, ...defs.bulk].find(
      (item) => item.name === actionName
    )
    if (!action) return errorJson(ctx, t('Action not found'), 404)
    const id = ctx.params.rid
    let record =
      id === undefined
        ? undefined
        : await lookupOrNull(() => query.clone().where(keyName(related), id).first())
    if (id !== undefined && !record) return errorJson(ctx, t('Record not found'), 404)
    const data = ctx.request.input('data', ctx.request.all()) as Record<string, unknown>
    let records: LucidRow[] | undefined
    if ((!action.builtin || action.builtin === 'bulk') && defs.bulk.includes(action)) {
      if (
        !Array.isArray(data.ids) ||
        !data.ids.length ||
        data.ids.some((value) => typeof value !== 'string' && typeof value !== 'number')
      )
        return errorJson(ctx, t('Invalid related record selection'), 422)
      const ids = [...new Set(data.ids as (string | number)[])]
      records =
        (await lookupOrNull(() => query.clone().whereIn(keyName(related), ids))) ?? undefined
      if (!records || records.length !== ids.length)
        return errorJson(ctx, t('Related record not found'), 404)
    }
    if (!action.builtin || action.builtin === 'bulk') {
      for (const row of records ?? (record ? [record] : []))
        await ensureModelAbility(ctx, related, 'view', row)
    }
    if (action.visible && !(await action.visible({ record: record ?? records?.[0] ?? null, ctx })))
      throw new E_PUPITRE_FORBIDDEN()
    const ability =
      action.can ??
      (action.builtin === 'attach'
        ? 'attach'
        : action.builtin === 'detach'
          ? 'detach'
          : action.builtin === 'associate'
            ? 'associate'
            : action.builtin === 'dissociate'
              ? 'dissociate'
              : action.builtin === 'delete'
                ? 'delete'
                : action.builtin === 'edit'
                  ? 'update'
                  : action.builtin === 'view'
                    ? 'view'
                    : action.builtin === 'create'
                      ? 'create'
                      : undefined)
    if (
      ability &&
      (record || action.builtin === 'create') &&
      !(await authorizeModel(ctx, related, ability, record ?? undefined))
    )
      throw new E_PUPITRE_FORBIDDEN()
    if (action.builtin === 'create') {
      const nodes = manager.form ?? relatedResource?.definition.form
      if (!nodes) return errorJson(ctx, t('Relation form is missing'), 422)
      const validated = await validateResourceData(ctx, related, nodes, data)
      await target.model.transaction(async (trx) => {
        parent.useTransaction(trx)
        const attributes = await fillRelatedOwnership(ctx, related, validated, relatedResource)
        await relationClient(parent, manager.relation).create(attributes)
      })
      await publishResourceChange(ctx, target.slug)
      return actionJson(ctx, {
        flash: [],
        reload: true,
        redirect: currentPageUrl(ctx, relationUrl(target, manager, parent)),
      })
    }
    if (action.builtin === 'attach') {
      const ids = Array.isArray(data.ids) ? data.ids : [data.id]
      if (
        !ids.length ||
        ids.some((value) => typeof value !== 'string' && typeof value !== 'number')
      )
        return errorJson(ctx, t('Invalid related record selection'), 422)
      const keys = ids as (string | number)[]
      const attachableQuery = related.query()
      await applyRelatedScope(ctx, related, attachableQuery, relatedResource)
      const attachable = await lookupOrNull(() => attachableQuery.whereIn(keyName(related), keys))
      if (!attachable || attachable.length !== keys.length)
        return errorJson(ctx, t('Related record not found'), 404)
      for (const row of attachable) {
        if (!(await authorizeModel(ctx, related, 'attach', row))) throw new E_PUPITRE_FORBIDDEN()
      }
      let attachments: (string | number)[] | Record<string, Record<string, unknown>> = keys
      if (manager.form?.length) {
        const pivotData = await validateResourceData(ctx, related, manager.form, data)
        const pivot = Object.fromEntries(
          Object.entries(pivotData).filter(([, value]) => value !== undefined)
        )
        if (Object.keys(pivot).length)
          attachments = Object.fromEntries(keys.map((key) => [String(key), pivot]))
      }
      await relationClient(parent, manager.relation).attach(attachments)
      await publishResourceChange(ctx, target.slug)
      return actionJson(ctx, { flash: [], reload: true })
    }
    if (action.builtin === 'detach' || action.builtin === 'delete') {
      const ids = id === undefined ? (Array.isArray(data.ids) ? data.ids : []) : [id]
      if (
        !ids.length ||
        ids.some((value) => typeof value !== 'string' && typeof value !== 'number')
      )
        return errorJson(ctx, t('Invalid related record selection'), 422)
      const keys = ids as (string | number)[]
      const rows = await lookupOrNull(() => query.clone().whereIn(keyName(related), keys))
      if (!rows || rows.length !== keys.length)
        return errorJson(ctx, t('Related record not found'), 404)
      const rowAbility = action.builtin === 'detach' ? 'detach' : 'delete'
      for (const row of rows) {
        if (!(await authorizeModel(ctx, related, rowAbility, row))) throw new E_PUPITRE_FORBIDDEN()
      }
      if (action.builtin === 'detach' && relation.type === 'manyToMany')
        await relationClient(parent, manager.relation).detach(keys)
      else if (action.builtin === 'delete' && relatedResource)
        await executeBuiltinDelete(relatedResource.definition, rows, ctx)
      else if (action.builtin === 'delete') {
        await related.transaction(async (trx) => {
          for (const row of rows) {
            row.useTransaction(trx)
            await row.delete()
          }
        })
        await cleanupRecordFiles(manager.form, rows, ctx)
      } else return errorJson(ctx, t('Detach requires a manyToMany relation'), 400)
      await publishResourceChange(ctx, target.slug)
      return actionJson(ctx, { flash: [], reload: true })
    }
    if (action.builtin === 'associate' || action.builtin === 'dissociate') {
      if (relation.type !== 'hasMany')
        return errorJson(ctx, t('Association requires a hasMany relation'), 400)
      relation.boot()
      const foreignKey = (relation as { foreignKey: string }).foreignKey
      const ids = id === undefined ? (Array.isArray(data.ids) ? data.ids : []) : [id]
      if (
        !ids.length ||
        ids.some((value) => typeof value !== 'string' && typeof value !== 'number')
      )
        return errorJson(ctx, t('Invalid related record selection'), 422)
      const keys = ids as (string | number)[]
      let candidates = query.clone()
      if (action.builtin === 'associate') {
        candidates = related.query()
        await applyRelatedScope(ctx, related, candidates, relatedResource)
        candidates.whereNull(foreignKey)
      }
      const rows = await lookupOrNull(() => candidates.whereIn(keyName(related), keys))
      if (!rows || rows.length !== keys.length)
        return errorJson(ctx, t('Related record not found'), 404)
      const associationAbility = action.builtin === 'associate' ? 'associate' : 'dissociate'
      for (const row of rows) {
        if (!(await authorizeModel(ctx, related, associationAbility, row)))
          throw new E_PUPITRE_FORBIDDEN()
      }
      const parentId = parent.$getAttribute(keyName(target.model))
      await related.transaction(async (trx) => {
        for (const row of rows) {
          row.useTransaction(trx)
          row.$setAttribute(foreignKey, action.builtin === 'associate' ? parentId : null)
          await row.save()
        }
      })
      await publishResourceChange(ctx, target.slug)
      return actionJson(ctx, { flash: [], reload: true })
    }
    if (action.builtin === 'edit' && record) {
      const nodes = manager.form ?? relatedResource?.definition.form
      if (!nodes) return errorJson(ctx, t('Relation form is missing'), 422)
      const validated = await validateResourceData(ctx, related, nodes, data, record)
      record.merge(validated as never)
      await record.save()
      await publishResourceChange(ctx, target.slug)
      return actionJson(ctx, { flash: [], reload: true })
    }
    if ((!action.builtin || action.builtin === 'bulk') && action.handle) {
      const result = await executeAction(action, {
        ctx,
        record: record ?? undefined,
        records,
        data,
        beforeHandle: action.form
          ? (validated) => consumeFormUploads(ctx, target.slug, [...action.form!], validated)
          : undefined,
        authorize: (requestedAbility, row) => authorizeModel(ctx, related, requestedAbility, row),
        currentUrl: currentPageUrl(ctx, relationUrl(target, manager, parent)),
        listUrl: target.urls.list,
      })
      await publishResourceChange(ctx, target.slug)
      return actionJson(ctx, result)
    }
    return errorJson(ctx, t('Unsupported relation action'), 400)
  }
}
