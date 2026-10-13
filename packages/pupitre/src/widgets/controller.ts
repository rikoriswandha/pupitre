import { t } from '../i18n.js'
import type { HttpContext } from '@adonisjs/core/http'
import { tableData as tableDataSchema, widgetData as widgetDataSchema } from '../../catalog/wire.js'
import type { WidgetData, WidgetDescriptor } from '../../catalog/wire.js'
import type { TimelineItem, WidgetDefinition } from '../definition/widget.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import { buildPanelPageProps, pageKey, panelBreadcrumb } from '../http/page_props.js'
import { authorizeResource, authorizeModel, ensureAuthorized } from '../authz/bouncer.js'
import { requestResource, scopedQuery } from '../query/scoped_query.js'
import type { LucidRow, ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { compileTable } from '../compiler/table_compiler.js'
import { applyTableQuery } from '../query/table_query.js'
import { buildTableData } from '../table/table_data.js'
import { aggregateTableSummaries } from '../table/table_summary.js'
import { authorizeNestedParent } from '../http/controllers/nested_resource_guards.js'
import { formatDateTime, toDateTime } from '../format/index.js'
import { authorizeAbility } from '../authz/bouncer.js'
import { E_PUPITRE_NOT_FOUND } from '../errors.js'
import { compileActionForm, executeAction } from '../compiler/action_compiler.js'
import { actionJson, errorJson } from '../http/responses.js'
import vine from '@vinejs/vine'
import { loadCustomTable } from '../table/custom_table.js'
import { compileActionDescriptor } from '../compiler/action_compiler.js'
import type { ActionDefinition } from '../definition/action.js'
import { compileForm } from '../compiler/schema_compiler.js'

function authorizeTableAction(ctx: HttpContext, ability: string, row?: unknown) {
  return authorizeAbility(ctx, ability, row)
}

async function widgetTableActions(
  ctx: HttpContext,
  definition: WidgetDefinition,
  group: 'row' | 'header' | 'bulk',
  baseUrl: string,
  record?: Record<string, unknown>
) {
  const result = []
  for (const action of definition.table?.actions?.[group] ?? []) {
    const url = new URL(baseUrl, 'http://pupitre.local')
    url.pathname += `/actions/${encodeURIComponent(action.name)}`
    url.searchParams.set('tableAction', group)
    const key = record?.[definition.table?.recordKey ?? 'id']
    if (typeof key === 'string' || typeof key === 'number')
      url.searchParams.set('rowKey', String(key))
    const descriptor = await compileActionDescriptor(
      {
        ...action,
        context: group === 'row' ? 'record' : group,
        visible: action.visible
          ? () => action.visible!({ record: record ?? null, ctx })
          : undefined,
        url: action.url,
      },
      {
        ctx,
        baseUrl,
        recordKey: typeof key === 'string' || typeof key === 'number' ? key : undefined,
        authorize: (ability) => authorizeTableAction(ctx, ability, record),
        routes: { list: '', create: '', edit: () => '', view: () => '', destroy: () => '' },
      }
    )
    result.push({
      ...descriptor,
      url: action.url ? descriptor.url : `${url.pathname}${url.search}`,
    })
  }
  return result
}
function filtersFrom(ctx: HttpContext): Record<string, unknown> {
  const query = ctx.request.qs() as Record<string, unknown>
  return typeof query.filters === 'object' && query.filters !== null
    ? { ...query, ...query.filters }
    : query
}

function pollMilliseconds(value?: string): number | undefined {
  if (!value) return undefined
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)$/.exec(value)
  if (!match) throw new Error(`Invalid widget polling interval "${value}"`)
  const amount = Number(match[1])
  return Math.round(amount * (match[2] === 'ms' ? 1 : match[2] === 's' ? 1000 : 60_000))
}

async function canView(ctx: HttpContext, definition: WidgetDefinition): Promise<void> {
  if (definition.canView && !(await definition.canView(ctx))) throw new E_PUPITRE_FORBIDDEN()
}
async function loadTableWidget(
  ctx: HttpContext,
  definition: WidgetDefinition,
  record?: unknown,
  pageContext?: WidgetPageContext
) {
  const table = definition.table
  const model = definition.model
  if (table?.records) {
    const query = ctx.request.qs()
    const pageSlug =
      typeof query.customPage === 'string'
        ? query.customPage
        : ctx.pupitre.panel.pages.some((page) => page.slug === ctx.params.slug)
          ? ctx.params.slug
          : undefined
    const context: WidgetPageContext | undefined =
      pageContext ??
      (pageSlug
        ? { customPage: pageSlug }
        : typeof query.resource === 'string'
          ? {
              resource: query.resource,
              widgetPage: query.widgetPage as 'list' | 'create' | 'edit' | 'view',
            }
          : typeof ctx.params.slug === 'string'
            ? { resource: ctx.params.slug, widgetPage: 'list' }
            : undefined)
    const url = widgetDataUrl(ctx, definition, record, context)
    return loadCustomTable(
      ctx,
      table,
      definition.name,
      (row) => widgetTableActions(ctx, definition, 'row', url, row),
      record
    )
  }
  if (!table || !model) throw new Error(`Table widget "${definition.name}" requires a model`)
  const resource = ctx.pupitre.panel.resources.find((item) => item.model === model)
  if (resource && !(await authorizeResource(ctx, resource, 'viewAny')))
    throw new E_PUPITRE_FORBIDDEN()
  if (!resource && !(await authorizeModel(ctx, model, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
  if (!resource && ctx.pupitre.tenant)
    throw new Error(
      `Tenant-scoped table widget "${definition.name}" must use a registered resource model`
    )
  const query = resource ? scopedQuery(ctx, resource) : model.query()
  const loaded = applyTableQuery(query, table, ctx.request.qs() as Record<string, unknown>, {
    ctx,
    prefix: definition.name,
  })
  const preloaded: Record<string, true> = {}
  for (const column of table.columns) {
    if (column.kind === 'fragment') continue
    if (column.countRelation)
      query.withCount(column.countRelation as never, (countQuery: { as(name: string): unknown }) =>
        countQuery.as(`${column.countRelation}_count`)
      )
    const relation = column.name.includes('.') ? column.name.split('.')[0] : undefined
    if (relation && !preloaded[relation] && model.$getRelation(relation)) {
      query.preload(relation as never)
      preloaded[relation] = true
    }
  }
  const summaryResult = table.columns.some(
    (column) => column.kind !== 'fragment' && column.summaries?.length
  )
    ? await aggregateTableSummaries(loaded.query, table, {
        locale: ctx.pupitre.locale,
        timezone: ctx.pupitre.timezone,
        normalized: loaded.normalized,
      })
    : undefined
  let rows: LucidRow[]
  let meta: unknown
  if (loaded.perPage === 'all') {
    rows = await loaded.query.exec()
    meta = {
      total: rows.length,
      perPage: rows.length || 1,
      currentPage: 1,
      lastPage: 1,
      from: rows.length ? 1 : 0,
      to: rows.length,
    }
  } else {
    const paginated = (await loaded.query.paginate(
      loaded.page,
      loaded.perPage
    )) as ModelPaginatorContract<LucidRow>
    rows = paginated.all()
    meta = paginated.getMeta()
  }
  return tableDataSchema.parse(
    await buildTableData(table, rows, meta, {
      ctx,
      locale: ctx.pupitre.locale,
      timezone: ctx.pupitre.timezone,
      normalized: loaded.normalized,
      rowActions: async () => [],
      rowUrl: (row) =>
        resource ? resource.urls.view(row.$primaryKeyValue as string | number) : undefined,
      ...(summaryResult?.summary ? { summary: summaryResult.summary } : {}),
      ...(summaryResult?.groups ? { groupSummaries: summaryResult.groups } : {}),
    })
  )
}

export async function loadWidget(
  ctx: HttpContext,
  definition: WidgetDefinition,
  record?: unknown,
  checkVisibility = true,
  context?: WidgetPageContext
): Promise<WidgetData> {
  if (checkVisibility) await canView(ctx, definition)
  // Edit access alone does not grant access to a record's history.
  if (definition.kind === 'timeline' && record && typeof ctx.params.slug === 'string') {
    const resource = requestResource(ctx, ctx.params.slug)
    if (resource) await ensureAuthorized(ctx, resource, 'view', record as LucidRow)
  }
  const loaded =
    definition.kind === 'table'
      ? await loadTableWidget(ctx, definition, record, context)
      : definition.load
        ? await definition.load({
            ctx,
            filters: filtersFrom(ctx),
            ...(record === undefined ? {} : { record }),
          })
        : {}
  const data =
    definition.kind === 'stats'
      ? { kind: 'stats' as const, stats: loaded }
      : definition.kind === 'chart'
        ? {
            kind: definition.chartType === 'scatter' ? ('scatter' as const) : ('chart' as const),
            ...(loaded as object),
          }
        : definition.kind === 'table'
          ? { kind: 'table' as const, data: loaded }
          : definition.kind === 'timeline'
            ? {
                kind: 'timeline' as const,
                items: (loaded as TimelineItem[]).map((item) => {
                  const date = toDateTime(item.time)
                  if (!date)
                    throw new Error(`Timeline widget "${definition.name}" has an invalid time`)
                  return {
                    ...item,
                    time: {
                      iso: date.toISO()!,
                      formatted: formatDateTime(date, ctx.pupitre)!,
                    },
                  }
                }),
              }
            : { kind: 'component' as const, data: loaded }
  return widgetDataSchema.parse(data)
}

export function widgetDescriptor(
  definition: WidgetDefinition,
  placement?: 'header' | 'footer',
  table?: WidgetDescriptor['table'],
  dataUrl?: string
): WidgetDescriptor {
  return {
    name: definition.name,
    kind: definition.kind,
    dataProp: `widget_${placement ?? 'dashboard'}_${definition.name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    ...(dataUrl ? { dataUrl } : {}),
    ...(placement ? { placement } : {}),
    ...(definition.heading ? { heading: definition.heading } : {}),
    ...(definition.description ? { description: definition.description } : {}),
    span: definition.span,
    sort: definition.sort,
    ...(pollMilliseconds(definition.poll) ? { poll: pollMilliseconds(definition.poll) } : {}),
    ...(definition.chartType ? { chartType: definition.chartType } : {}),
    ...(definition.component ? { component: definition.component } : {}),
    ...(table ? { table } : {}),
  }
}
type WidgetPageContext =
  { resource: string; widgetPage: 'list' | 'create' | 'edit' | 'view' } | { customPage: string }

function widgetDataUrl(
  ctx: HttpContext,
  definition: WidgetDefinition,
  record?: unknown,
  context?: WidgetPageContext
) {
  const url = new URL(
    `${ctx.pupitre.panel.path.replace(/\/$/, '')}/_pupitre/widgets/${encodeURIComponent(definition.name)}`,
    'http://pupitre.local'
  )
  if (context) {
    for (const [key, value] of Object.entries(context)) url.searchParams.set(key, value)
    if ('resource' in context) {
      const resource = requestResource(ctx, context.resource)
      if (resource?.parent) {
        const parentId = ctx.params[resource.parent.param]
        if (typeof parentId === 'string' || typeof parentId === 'number')
          url.searchParams.set('parentId', String(parentId))
      }
    }
  }
  if (record && typeof ctx.params.slug === 'string') {
    const id = (record as LucidRow).$primaryKeyValue
    if (typeof id === 'string' || typeof id === 'number') {
      url.searchParams.set('resource', ctx.params.slug)
      url.searchParams.set('record', String(id))
    }
  }
  return `${url.pathname}${url.search}`
}
async function compileWidgetTable(
  ctx: HttpContext,
  definition: WidgetDefinition,
  descriptor: WidgetDescriptor
) {
  if (!definition.table) return undefined
  const bulkActions = await widgetTableActions(ctx, definition, 'bulk', descriptor.dataUrl!)
  const compiled = await compileTable(definition.table, {
    url: ctx.request.url(),
    id: `${ctx.pupitre.panel.id}.widget.${definition.name}`,
    dataProp: descriptor.dataProp,
    queryPrefix: definition.name,
    bulkActions,
    compileFilterForm: async (nodes) => {
      const compiledFilter = await compileForm([...nodes], {
        ctx,
        locale: ctx.pupitre.locale,
        timezone: ctx.pupitre.timezone,
        form: { method: 'get', url: ctx.request.url(), submitLabel: t('Apply'), dirtyGuard: false },
      })
      return compiledFilter.spec
    },
  })
  return {
    ...compiled,
    headerActions: await widgetTableActions(ctx, definition, 'header', descriptor.dataUrl!),
  }
}
export async function prepareWidgets(
  ctx: HttpContext,
  definitions: WidgetDefinition[],
  record?: unknown,
  placement?: 'header' | 'footer',
  context?: WidgetPageContext
) {
  const visible: WidgetDefinition[] = []
  for (const definition of definitions) {
    if (definition.kind === 'timeline' && record && typeof ctx.params.slug === 'string') {
      const resource = requestResource(ctx, ctx.params.slug)
      if (resource && !(await authorizeResource(ctx, resource, 'view', record as LucidRow)))
        continue
    }
    if (!definition.canView || (await definition.canView(ctx))) visible.push(definition)
  }
  const deferred: string[] = []
  const extraProps: Record<string, unknown> = {}
  const widgets: WidgetDescriptor[] = []
  for (const definition of visible) {
    const initial = widgetDescriptor(
      definition,
      placement,
      undefined,
      widgetDataUrl(ctx, definition, record, context)
    )
    const table = await compileWidgetTable(ctx, definition, initial)
    const item = widgetDescriptor(
      definition,
      placement,
      table,
      widgetDataUrl(ctx, definition, record, context)
    )
    widgets.push(item)
    if (definition.lazy) {
      deferred.push(item.dataProp)
      extraProps[item.dataProp] = ctx.inertia.defer((() =>
        loadWidget(ctx, definition, record, false, context)) as never)
    } else {
      extraProps[item.dataProp] = await loadWidget(ctx, definition, record, false, context)
    }
  }
  return { widgets, deferred, extraProps }
}

export default class WidgetController {
  async dashboard(ctx: HttpContext) {
    const definitions: WidgetDefinition[] = []
    for (const item of ctx.pupitre.panel.widgets) {
      if (!item.canView || (await item.canView(ctx))) definitions.push(item)
    }
    const descriptors: WidgetDescriptor[] = []
    const deferred: string[] = []
    const extraProps: Record<string, unknown> = {}
    for (const definition of definitions) {
      const initial = widgetDescriptor(
        definition,
        undefined,
        undefined,
        widgetDataUrl(ctx, definition)
      )
      const table = await compileWidgetTable(ctx, definition, initial)
      const item = widgetDescriptor(definition, undefined, table, widgetDataUrl(ctx, definition))
      descriptors.push(item)
      if (definition.lazy) {
        deferred.push(item.dataProp)
        extraProps[item.dataProp] = ctx.inertia.defer((() =>
          loadWidget(ctx, definition, undefined, false)) as never)
      } else {
        extraProps[item.dataProp] = await loadWidget(ctx, definition, undefined, false)
      }
    }
    const props = buildPanelPageProps({
      ctx,
      key: pageKey(ctx, 'dashboard', 'dashboard'),
      kind: 'dashboard',
      title: t('Dashboard'),
      breadcrumbs: [panelBreadcrumb(ctx)],
      spec: { root: 'dashboard', elements: { dashboard: { type: 'Fragment', props: {} } } },
      state: {},
      widgets: descriptors,
      deferred,
      filters: ctx.pupitre.panel.dashboardFilters
        ? [...ctx.pupitre.panel.dashboardFilters]
        : undefined,
      extraProps,
    })
    return ctx.inertia.render('pupitre' as never, props as never)
  }

  private async resolve(ctx: HttpContext) {
    const query = ctx.request.qs() as Record<string, unknown>
    let record: LucidRow | undefined
    let definition: WidgetDefinition | undefined
    if (typeof query.customPage === 'string') {
      const page = ctx.pupitre.panel.pages.find((item) => item.slug === query.customPage)
      if (!page) throw new E_PUPITRE_NOT_FOUND()
      if (page.definition.canAccess && !(await page.definition.canAccess(ctx)))
        throw new E_PUPITRE_FORBIDDEN()
      definition = page.definition.widgets?.find((item) => item.name === ctx.params.name)
    } else if (typeof query.resource === 'string') {
      const target = ctx.pupitre.panel.resources.find((item) => item.slug === query.resource)
      if (!target) throw new E_PUPITRE_NOT_FOUND()
      if (target.parent) {
        if (typeof query.parentId !== 'string') throw new E_PUPITRE_NOT_FOUND()
        ctx.params[target.parent.param] = query.parentId
      }
      ctx.params.slug = query.resource
      const resource = requestResource(ctx, query.resource)!
      const page = query.widgetPage
      if (typeof page !== 'string' || !['list', 'create', 'edit', 'view'].includes(page))
        throw new E_PUPITRE_NOT_FOUND()
      await authorizeNestedParent(ctx, resource, page === 'create' || page === 'edit')
      if (!(await authorizeResource(ctx, resource, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
      if (page === 'edit' || page === 'view') {
        if (typeof query.record !== 'string') throw new E_PUPITRE_NOT_FOUND()
        const primaryKey = resource.model.primaryKey ?? 'id'
        record =
          (await scopedQuery(ctx, resource).where(primaryKey, query.record).first()) ?? undefined
        if (!record) throw new E_PUPITRE_NOT_FOUND()
        await ensureAuthorized(ctx, resource, page === 'edit' ? 'update' : 'view', record)
      } else if (page === 'create') {
        await ensureAuthorized(ctx, resource, 'create')
      }
      const pageNames = [page as 'list' | 'create' | 'edit' | 'view']
      definition = pageNames
        .flatMap((name) => [
          ...(resource.definition.pages[name]?.widgets ?? []),
          ...(resource.definition.pages[name]?.footerWidgets ?? []),
        ])
        .find((item) => item.name === ctx.params.name)
    } else {
      definition = ctx.pupitre.panel.widgets.find((item) => item.name === ctx.params.name)
    }
    if (!definition) throw new E_PUPITRE_NOT_FOUND()
    await canView(ctx, definition)
    return { definition, record }
  }

  async data(ctx: HttpContext) {
    const { definition, record } = await this.resolve(ctx)
    return ctx.response.ok(await loadWidget(ctx, definition, record, false))
  }

  async action(ctx: HttpContext) {
    const resolved = await this.resolve(ctx)
    const { definition } = resolved
    let record: unknown = resolved.record
    let records: Record<string, unknown>[] | undefined
    const query: Record<string, unknown> = ctx.request.qs()
    const group = query.tableAction
    if (group !== undefined && group !== 'row' && group !== 'bulk' && group !== 'header')
      throw new E_PUPITRE_NOT_FOUND()
    let action: ActionDefinition | undefined
    if (group === 'row' || group === 'bulk' || group === 'header') {
      record = undefined
      action = definition.table?.actions?.[group]?.find((item) => item.name === ctx.params.action)
      if (!action) throw new E_PUPITRE_NOT_FOUND()
      if (group === 'row' || (group === 'bulk' && ctx.request.method() !== 'GET')) {
        if (!definition.table?.resolveRecord) throw new E_PUPITRE_NOT_FOUND()
        const keys = group === 'row' ? [query.rowKey] : ctx.request.input('ids', [])
        const keySchema = vine.union([
          vine.union.if((value) => typeof value === 'string', vine.string()),
          vine.union.if((value) => typeof value === 'number', vine.number()),
        ])
        const validated = await vine
          .compile(vine.object({ keys: vine.array(keySchema).minLength(1) }))
          .validate({ keys })
        records = []
        for (const key of validated.keys) {
          const row = await definition.table.resolveRecord(key, ctx)
          if (!row) throw new E_PUPITRE_NOT_FOUND()
          records.push(row)
        }
        record = group === 'row' ? records[0] : undefined
        if (group === 'row') records = undefined
      }
    } else action = definition.actions?.find((item) => item.name === ctx.params.action)
    if (!action) throw new E_PUPITRE_NOT_FOUND()
    const resource =
      typeof ctx.params.slug === 'string' ? requestResource(ctx, ctx.params.slug) : undefined
    const authorize = (ability: string, target?: unknown) =>
      group
        ? authorizeTableAction(ctx, ability, target)
        : resource
          ? authorizeResource(ctx, resource, ability, resolved.record)
          : authorizeAbility(ctx, ability, target)
    if (action.can) {
      for (const target of records?.length ? records : [record])
        if (!(await authorize(action.can, target))) throw new E_PUPITRE_FORBIDDEN()
    }
    if (action.visible && !action.visible({ record: record ?? null, ctx }))
      throw new E_PUPITRE_FORBIDDEN()
    if (ctx.request.method() === 'GET') {
      return ctx.response.ok(
        await compileActionForm(action, {
          ctx,
          record:
            record && typeof record === 'object'
              ? Object.fromEntries(Object.entries(record))
              : undefined,
          model: group ? undefined : resolved.record,
          locale: ctx.pupitre.locale,
          timezone: ctx.pupitre.timezone,
          url: `${ctx.request.url()}?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])).toString()}`,
        })
      )
    }
    try {
      const envelope = await vine
        .compile(vine.object({ data: vine.record(vine.any()).optional() }))
        .validate(ctx.request.body())
      const result = await executeAction(action, {
        ctx,
        record,
        records,
        data: envelope.data ?? {},
        authorize,
        currentUrl: '',
        listUrl: ctx.pupitre.panel.path,
      })
      return actionJson(ctx, result)
    } catch (error) {
      if ((error as { status?: number })?.status !== 422) throw error
      const errors: Record<string, string[]> = {}
      for (const message of (error as { messages?: { field?: string; message: string }[] })
        .messages ?? [])
        (errors[message.field ?? '_form'] ??= []).push(message.message)
      return errorJson(ctx, t('The submitted data is invalid'), 422, errors)
    }
  }
}
