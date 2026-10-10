import app from '@adonisjs/core/services/app'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { HttpContext } from '@adonisjs/core/http'
import { compileForm, compileInfolist } from '../../compiler/schema_compiler.js'
import { validateResourceData } from '../validation.js'
import { compileTable } from '../../compiler/table_compiler.js'
import { applyTableQuery } from '../../query/table_query.js'
import { buildTableData } from '../../table/table_data.js'
import { compileActionDescriptor, executeBuiltinDelete } from '../../compiler/action_compiler.js'
import { ensureAuthorized, authorizeResource } from '../../authz/bouncer.js'
import { buildPageProps } from '../page_props.js'
import { isPupitreActionRequest, actionJson, errorJson, setPupitreFlash } from '../responses.js'
import type { ResourceRuntime } from '../../manager.js'
import type { ActionDefinition } from '../../definition/action.js'
import type { FieldDefinitionUnion, SchemaNodeDefinition } from '../../definition/schema.js'
import { resolveFileUrl, cleanupReplacedFiles } from '../../storage/index.js'
import type { UploadField } from '../../storage/index.js'
import { findUploadField } from '../../storage/upload_validation.js'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import { createSpecCacheKey, SpecCache } from '../../compiler/cache.js'
import type { PupitreConfig } from '../../define_config.js'
import type { ActionDescriptor, JsonRenderSpec } from '../../../catalog/wire.js'
import { actions as builtInActions } from '../../builder/action.js'

const schemaCache = new SpecCache<JsonRenderSpec>()

async function resource(ctx: HttpContext): Promise<ResourceRuntime> {
  const manager = (await ctx.containerResolver.make('pupitre.manager')) as {
    findResource(panelId: string, slug: string): ResourceRuntime | undefined
  }
  const result = manager.findResource(ctx.pupitre.panel.id, ctx.params.slug)
  if (!result) throw new Error(`Unknown Pupitre resource "${ctx.params.slug}"`)
  return result
}

function setRedirectFlash(ctx: HttpContext, flash: unknown) {
  if (!isPupitreActionRequest(ctx) && ctx.request.accepts(['json', 'html']) !== 'json')
    setPupitreFlash(ctx, flash)
}

function pruneUploads(ctx: HttpContext, resourceSlug: string) {
  const uploads = (ctx.session.get('pupitre.uploads') ?? []) as { resource: string }[]
  ctx.session.put(
    'pupitre.uploads',
    uploads.filter((upload) => upload.resource !== resourceSlug)
  )
}

function uploadFields(nodes: SchemaNodeDefinition[]): UploadField[] {
  const fields: UploadField[] = []
  for (const node of nodes) {
    if (node.kind === 'fileUpload') fields.push(node as UploadField)
    if ('children' in node && Array.isArray(node.children))
      fields.push(...uploadFields(node.children))
    if (node.kind === 'repeater' && Array.isArray(node.schema))
      fields.push(...uploadFields(node.schema as SchemaNodeDefinition[]))
  }
  return fields
}

function keyName(model: LucidModel): string {
  return (model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
}

async function findRecord(ctx: HttpContext, target: ResourceRuntime): Promise<LucidRow | null> {
  const query = target.model.query()
  target.definition.scope?.(query, ctx)
  return query.where(keyName(target.model), ctx.params.id).first()
}

function serialized(record: LucidRow): Record<string, unknown> {
  return record.serialize() as Record<string, unknown>
}
function recordValue(record: LucidRow, name: string): unknown {
  return record.$attributes[name]
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
            ctx.pupitre.panel.id,
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
  record?: LucidRow
): Promise<ActionDescriptor[]> {
  return Promise.all(
    actions.map((action) =>
      compileActionDescriptor(action, {
        baseUrl: target.urls.list,
        ...(record
          ? { record, recordKey: recordValue(record, keyName(target.model)) as string | number }
          : {}),
        ctx,
        authorize: (ability, row) => authorizeResource(ctx, target, ability, row),
        routes: target.urls,
        resourceLabel: record ? target.label : target.pluralLabel,
      })
    )
  )
}
function headerDefinitions(
  target: ResourceRuntime,
  page: 'list' | 'create' | 'edit' | 'view'
): ActionDefinition[] {
  const definitions = [...(target.definition.actions?.header ?? [])]
  if (
    page === 'list' &&
    target.definition.pages.create &&
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
  if ((page === 'edit' || page === 'view') && !definitions.some((item) => item.name === 'delete')) {
    definitions.push(builtInActions.delete().definition)
  }
  return definitions
}

function render(ctx: HttpContext, props: object, component?: string) {
  return ctx.inertia.render((component ?? 'pupitre') as never, props as never)
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
    const spec = {
      root: 'table',
      elements: { table: { type: 'DataTable', props: { descriptor } } },
    } as JsonRenderSpec
    const scopedQuery = target.model.query()
    for (const column of table.columns) {
      if (column.kind !== 'fragment' && column.name.includes('.'))
        scopedQuery.preload(column.name.split('.')[0]! as never)
    }
    target.definition.scope?.(scopedQuery, ctx)
    const queryResult = applyTableQuery(scopedQuery, table, ctx.request.qs(), {
      ctx,
      tabs: pageConfig?.tabs,
    })
    for (const column of table.columns) {
      if (column.kind !== 'fragment' && column.name.includes('.'))
        queryResult.query.preload(column.name.split('.')[0]! as never)
    }
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
    const data = await buildTableData(table, rows, meta, {
      locale: ctx.pupitre.locale,
      timezone: ctx.pupitre.timezone,
      normalized: queryResult.normalized,
      rowUrl: (record) => rowUrls.get(record),
      rowActions: (record) => compileActions(ctx, target, definition.actions?.row ?? [], record),
      resolveFileUrl: (key, column) => {
        const field =
          column.kind === 'fragment'
            ? undefined
            : findUploadField(target.definition.form, column.name)
        return field ? resolveFileUrl(key, field) : Promise.resolve(null)
      },
    })
    return render(
      ctx,
      buildPageProps({
        ctx,
        resource: target,
        kind: 'list',
        spec,
        state: {},
        title: target.pluralLabel,
        headerActions,
        data,
      }),
      pageConfig?.component
    )
  }

  async create(ctx: HttpContext) {
    const target = await resource(ctx)
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
    return render(
      ctx,
      buildPageProps({
        ctx,
        resource: target,
        kind: 'create',
        spec: compiled.spec,
        state: compiled.state,
        title: `Create ${target.label}`,
        headerActions: actions,
      }),
      pageConfig.component
    )
  }

  async edit(ctx: HttpContext) {
    const target = await resource(ctx)
    await ensureAuthorized(ctx, target, 'viewAny')
    const record = await findRecord(ctx, target)
    if (!record) return ctx.response.notFound()
    await ensureAuthorized(ctx, target, 'update', record)
    const pageConfig = target.definition.pages.edit
    if (!pageConfig || !target.definition.form) return ctx.response.notFound()
    const data = (await target.definition.hooks.fill?.(record, ctx)) ?? serialized(record)
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
    const actions = await compileActions(ctx, target, headerDefinitions(target, 'edit'), record)
    const id = recordValue(record, keyName(target.model)) as string | number
    return render(
      ctx,
      buildPageProps({
        ctx,
        resource: target,
        kind: 'edit',
        spec: compiled.spec,
        state: compiled.state,
        title: String(data[target.definition.recordTitle ?? keyName(target.model)] ?? target.label),
        recordId: id,
        recordLabel: String(
          data[target.definition.recordTitle ?? keyName(target.model)] ?? target.label
        ),
        headerActions: actions,
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
    const actions = await compileActions(ctx, target, headerDefinitions(target, 'view'), record)
    const id = recordValue(record, keyName(target.model)) as string | number
    return render(
      ctx,
      buildPageProps({
        ctx,
        resource: target,
        kind: 'view',
        spec: compiled.spec,
        state: compiled.state,
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
      }),
      target.definition.pages.view?.component
    )
  }

  async store(ctx: HttpContext) {
    const target = await resource(ctx)
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
      const record = target.definition.handlers.create
        ? await target.definition.handlers.create(data, ctx, trx)
        : await target.model.create(data, { client: trx })
      ;(record as LucidRow).useTransaction(trx)
      await target.definition.hooks.afterCreate?.(record, ctx, trx)
      await target.definition.hooks.afterSave?.(record, ctx, trx)
      return record
    })
    pruneUploads(ctx, target.slug)
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
      fileFields.map((field) => [field.name, recordValue(record, field.name)])
    )
    await target.model.transaction(async (trx) => {
      const data =
        (await target.definition.hooks.mutateBeforeSave?.(validated, record, ctx, trx)) ?? validated
      await target.definition.hooks.beforeSave?.(record, data, ctx, trx)
      record.useTransaction(trx)
      const saved = target.definition.handlers.update
        ? ((await target.definition.handlers.update(record, data, ctx, trx)) as LucidRow)
        : ((await record.merge(data).save()) as LucidRow)
      saved.useTransaction(trx)
      await target.definition.hooks.afterSave?.(saved, ctx, trx)
    })
    pruneUploads(ctx, target.slug)
    for (const field of fileFields) {
      await cleanupReplacedFiles(field, oldValues.get(field.name), recordValue(record, field.name))
    }
    const flash = [{ type: 'success' as const, title: 'Saved' }]
    setRedirectFlash(ctx, flash)
    if (isPupitreActionRequest(ctx))
      return actionJson(ctx, { flash, redirect: target.urls.edit(ctx.params.id) })
    return ctx.response.redirect(target.urls.edit(ctx.params.id))
  }

  async destroy(ctx: HttpContext) {
    const target = await resource(ctx)
    await ensureAuthorized(ctx, target, 'viewAny')
    const record = await findRecord(ctx, target)
    if (!record) return ctx.response.notFound()
    await ensureAuthorized(ctx, target, 'delete', record)
    await executeBuiltinDelete(target.definition, [record], ctx)
    const flash = [{ type: 'success' as const, title: 'Deleted' }]
    setRedirectFlash(ctx, flash)
    if (isPupitreActionRequest(ctx))
      return actionJson(ctx, { flash, redirect: target.urls.list, deselect: true })
    return ctx.response.redirect(target.urls.list)
  }
}
