import vine from '@vinejs/vine'
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../../manager.js'
import type { PupitreConfig } from '../../define_config.js'
import type { TableDefinition } from '../../definition/table.js'
import {
  ensureAuthorized,
  authorizeModel,
  resolveResourcePolicy,
  resolveModelPolicy,
} from '../../authz/bouncer.js'
import { requestResource, scopedQuery } from '../../query/scoped_query.js'
import { flattenRelationManagers } from '../../definition/relation_manager.js'
import { E_PUPITRE_FORBIDDEN, E_PUPITRE_NOT_FOUND } from '../../errors.js'
import { deleteView, findOwnedView, listViews, saveView, viewScope } from './store.js'
import type { StoredView } from './store.js'
import { normalizeViewColumns, normalizeViewQuery, tableViewQueryKeys } from './normalize.js'
import { parseTableParams } from '../../query/table_query.js'
import type { TableDescriptor } from '../../../catalog/wire.js'
import { lookupOrNull } from '../../query/record_lookup.js'

const validator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    query: vine.record(vine.any()),
    columns: vine.record(vine.boolean()),
    isPublic: vine.boolean(),
    isDefault: vine.boolean(),
  })
)
export async function canManagePublicViews(
  ctx: HttpContext,
  target: ResourceRuntime,
  model = target.model
) {
  const config = (await app.container.make('pupitre.config')) as PupitreConfig
  const related = ctx.pupitre.panel.resources.find((resource) => resource.model === model)
  const policy = related
    ? await resolveResourcePolicy(related, config)
    : await resolveModelPolicy(model.name, config)
  if (
    !policy ||
    typeof (policy.prototype as Record<string, unknown>).managePublicViews !== 'function'
  )
    return false
  return authorizeModel(ctx, model, 'managePublicViews')
}
export async function prepareTableViews(
  ctx: HttpContext,
  target: ResourceRuntime,
  definition: TableDefinition,
  descriptor: TableDescriptor,
  model: LucidModel = target.model
) {
  if (!definition.savedViews && !definition.presetViews?.length) return
  const presets: StoredView[] = await Promise.all(
    (definition.presetViews ?? []).map(async (preset, index) => ({
      ...preset,
      id: `preset:${index}`,
      query: await normalizeViewQuery(
        model,
        definition,
        preset.query,
        ctx,
        descriptor.queryPrefix ? undefined : target.definition.pages.list?.tabs
      ),
      columns: normalizeViewColumns(definition, preset.columns ?? {}),
      source: 'preset',
      editable: false,
      isPublic: false,
      isDefault: preset.isDefault ?? false,
    }))
  )
  descriptor.views = {
    url: `${descriptor.url}/views`,
    enabled: definition.savedViews ?? false,
    canManagePublic: await canManagePublicViews(ctx, target, model),
    items: [
      ...presets,
      ...(definition.savedViews ? await listViews(viewScope(ctx, descriptor.id)) : []),
    ],
  }
}
export function defaultTableView(descriptor: TableDescriptor, params: Record<string, unknown>) {
  const state = parseTableParams(params, descriptor.queryPrefix)
  if (
    Object.keys(state).some(
      (key) =>
        tableViewQueryKeys.includes(key as (typeof tableViewQueryKeys)[number]) ||
        key === 'view' ||
        key === 'page' ||
        key.startsWith('filters[') ||
        key.startsWith('columns[')
    )
  )
    return undefined
  return (
    descriptor.views?.items.find((view) => view.source === 'mine' && view.isDefault) ??
    descriptor.views?.items.find((view) => view.source === 'preset' && view.isDefault)
  )
}
export function tableViewUrl(path: string, descriptor: TableDescriptor, view: StoredView) {
  const url = new URL(path, 'http://pupitre.invalid')
  const append = (key: string, value: unknown): void => {
    if (value && typeof value === 'object') {
      for (const [child, item] of Object.entries(value)) append(`${key}[${child}]`, item)
    } else if (value !== undefined && value !== null) {
      const name = descriptor.queryPrefix
        ? `${descriptor.queryPrefix}[${key.replaceAll(']', '').replaceAll('[', '][')}]`
        : key
      url.searchParams.set(name, String(value))
    }
  }
  for (const [key, value] of Object.entries({ ...view.query, view: view.id })) append(key, value)
  return `${url.pathname}${url.search}`
}
async function resolve(ctx: HttpContext) {
  const target = requestResource(ctx, ctx.params.slug)
  if (!target) throw new E_PUPITRE_NOT_FOUND()
  await ensureAuthorized(ctx, target, 'viewAny')
  if (target.parent) {
    const ancestor = requestResource(ctx, target.parent.resource)
    if (!ancestor) throw new E_PUPITRE_NOT_FOUND()
    await ensureAuthorized(ctx, ancestor, 'viewAny')
    const parent = await lookupOrNull(() =>
      scopedQuery(ctx, ancestor)
        .where(ancestor.model.primaryKey, ctx.params[target.parent!.param])
        .first()
    )
    if (!parent) throw new E_PUPITRE_NOT_FOUND()
    await ensureAuthorized(ctx, ancestor, 'view', parent)
  }
  let table = target.definition.table
  let model = target.model
  let prefix: string | undefined
  if (ctx.params.relation) {
    const parent = await lookupOrNull(() =>
      scopedQuery(ctx, target).where(target.model.primaryKey, ctx.params.id).first()
    )
    if (!parent) throw new E_PUPITRE_NOT_FOUND()
    await ensureAuthorized(ctx, target, 'view', parent)
    const manager = flattenRelationManagers(target.definition.relations).find(
      (relation) => relation.relation === ctx.params.relation
    )
    if (!manager) throw new E_PUPITRE_NOT_FOUND()
    const relation = target.model.$getRelation(manager.relation)
    relation.boot()
    model = relation.relatedModel() as LucidModel
    if (!(await authorizeModel(ctx, model, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
    table = manager.table
    prefix = manager.relation
  }
  if (!table?.savedViews) throw new E_PUPITRE_NOT_FOUND()
  const key = `${ctx.pupitre.panel.id}.${target.slug}${prefix ? `.${prefix}` : ''}`
  return { target, model, table, prefix, scope: viewScope(ctx, key) }
}
export default class TableViewsController {
  async index(ctx: HttpContext) {
    const { scope } = await resolve(ctx)
    return ctx.response.ok(await listViews(scope))
  }
  async store(ctx: HttpContext) {
    return this.persist(ctx)
  }
  async update(ctx: HttpContext) {
    return this.persist(ctx, ctx.params.view)
  }
  private async persist(ctx: HttpContext, id?: string) {
    const { target, model, table, prefix, scope } = await resolve(ctx)
    const previous = id ? await findOwnedView(scope, id) : undefined
    if (id && !previous) throw new E_PUPITRE_NOT_FOUND()
    const input = await validator.validate(ctx.request.all())
    if ((input.isPublic || previous?.isPublic) && !(await canManagePublicViews(ctx, target, model)))
      throw new E_PUPITRE_FORBIDDEN()
    const query = await normalizeViewQuery(
      model,
      table,
      input.query,
      ctx,
      prefix ? undefined : target.definition.pages.list?.tabs
    )
    const columns = normalizeViewColumns(table, input.columns)
    return ctx.response.ok(await saveView(scope, { ...input, query, columns }, id))
  }
  async destroy(ctx: HttpContext) {
    const { target, model, scope } = await resolve(ctx)
    const previous = await findOwnedView(scope, ctx.params.view)
    if (!previous) throw new E_PUPITRE_NOT_FOUND()
    if (previous.isPublic && !(await canManagePublicViews(ctx, target, model)))
      throw new E_PUPITRE_FORBIDDEN()
    await deleteView(scope, ctx.params.view)
    return ctx.response.noContent()
  }
}
