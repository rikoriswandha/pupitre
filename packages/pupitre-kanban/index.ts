import { AsyncLocalStorage } from 'node:async_hooks'
import type { HttpContext } from '@adonisjs/core/http'
import { createError } from '@adonisjs/core/exceptions'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import {
  action,
  authorizeResource,
  definePage,
  definePlugin,
  defineWidget,
  schema,
  scopedQuery,
  t,
} from '@rikology/pupitre'
import type {
  PupitrePlugin,
  ResourceBuilder,
  ResourceDefinition,
  ResourceModel,
} from '@rikology/pupitre'

const Forbidden = createError(t('Kanban operation forbidden'), 'E_PUPITRE_KANBAN_FORBIDDEN', 403)
const NotFound = createError(t('Kanban record not found'), 'E_PUPITRE_KANBAN_NOT_FOUND', 404)
const Invalid = createError(t('Invalid kanban move'), 'E_PUPITRE_KANBAN_INVALID_MOVE', 422)
export type KanbanOptions = {
  statusColumn: string
  statuses: readonly { value: string; label: string; color?: string }[]
  title: string
  description?: string
  orderColumn?: string
  cardEntries?: readonly { name: string; label: string }[]
  limitPerColumn?: number
  page: { slug: string; label: string; icon?: string; navigationGroup?: string }
}
export type MoveRule = (
  record: LucidRow,
  from: string,
  to: string,
  ctx: HttpContext
) => boolean | Promise<boolean>
export type KanbanPlugin = PupitrePlugin & { canMove(rule: MoveRule): KanbanPlugin }

export function kanban(
  resource: ResourceBuilder<ResourceModel> | ResourceDefinition<LucidRow>,
  options: KanbanOptions
): KanbanPlugin {
  return build(resource, options)
}
function build(
  input: ResourceBuilder<ResourceModel> | ResourceDefinition<LucidRow>,
  options: KanbanOptions,
  rule?: MoveRule
): KanbanPlugin {
  const definition = 'toDefinition' in input ? input.toDefinition() : input
  if (
    !options.statuses.length ||
    new Set(options.statuses.map((item) => item.value)).size !== options.statuses.length
  )
    throw new Invalid()
  if (
    options.limitPerColumn !== undefined &&
    (!Number.isInteger(options.limitPerColumn) || options.limitPerColumn < 1)
  )
    throw new Invalid()
  const values = options.statuses.map((item) => item.value)
  const runtime = (ctx: HttpContext) => {
    const target = ctx.pupitre.panel.resources.find(
      (item) => item.definition.slug === definition.slug
    )
    if (!target || target.parent) throw new NotFound()
    return target
  }
  const access = async (ctx: HttpContext) => authorizeResource(ctx, runtime(ctx), 'viewAny')
  const load = async ({ ctx, filters }: { ctx: HttpContext; filters: Record<string, unknown> }) => {
    const target = runtime(ctx)
    if (!(await access(ctx))) throw new Forbidden()
    const columns = []
    for (const status of options.statuses) {
      const raw = Number(filters[`kanbanLimit_${status.value}`] ?? options.limitPerColumn)
      const limit = Number.isSafeInteger(raw) && raw > 0 ? raw : options.limitPerColumn
      // `pojo()` keeps the alias out of model attribute mapping (e.g. an Order `total` column).
      const count = await scopedQuery(ctx, target)
        .where(options.statusColumn, status.value)
        .count('* as kanban_total')
        .pojo<{ kanban_total: number | string }>()
        .first()
      const query = scopedQuery(ctx, target).where(options.statusColumn, status.value)
      if (options.orderColumn) query.orderBy(options.orderColumn, 'asc')
      if (limit !== undefined) query.limit(limit)
      const rows = await query.orderBy(target.model.primaryKey, 'asc')
      const cards = []
      for (const record of rows) {
        const movable = await authorizeResource(ctx, target, 'update', record)
        const viewable = await authorizeResource(ctx, target, 'view', record)
        const id = String(record.$primaryKeyValue)
        const url =
          viewable && target.definition.pages.view
            ? target.urls.view(id)
            : movable && target.definition.pages.edit
              ? target.urls.edit(id)
              : undefined
        const row = record as unknown as Record<string, unknown>
        cards.push({
          id: String(record.$primaryKeyValue),
          title: String(row[options.title] ?? ''),
          description: options.description ? String(row[options.description] ?? '') : undefined,
          movable,
          url,
          entries: (options.cardEntries ?? []).map((entry) => ({
            label: entry.label,
            value: String(row[entry.name] ?? ''),
          })),
        })
      }
      columns.push({
        ...status,
        cards,
        count: Number(count?.kanban_total ?? 0),
        limit: limit ?? rows.length,
      })
    }
    return {
      columns,
      createUrl:
        target.definition.pages.create && (await authorizeResource(ctx, target, 'create'))
          ? target.urls.create
          : undefined,
      statusColumn: options.statusColumn,
    }
  }
  const move = action('move')
    .form([
      schema.text('id').required(),
      schema
        .select('status')
        .options(Object.fromEntries(options.statuses.map((item) => [item.value, item.label])))
        .required(),
      schema.number('position').min(0).required(),
    ])
    .handle(async ({ data, ctx }) => {
      if (!ctx || !data) throw new Forbidden()
      const target = runtime(ctx)
      if (!(await access(ctx))) throw new Forbidden()
      const to = String(data.status)
      if (!values.includes(to) || !Number.isInteger(data.position)) throw new Invalid()
      // Lock every declared column in deterministic primary-key order. This serializes
      // opposite-direction moves on PostgreSQL without source/target lock inversion.
      await target.model.transaction(async (trx) => {
        const query = scopedQuery(ctx, target)
          .useTransaction(trx)
          .whereIn(options.statusColumn, values)
          .orderBy(target.model.primaryKey, 'asc')
        if (trx.dialect.name === 'postgres') query.forUpdate()
        const rows = await query
        const record = rows.find((row) => String(row.$primaryKeyValue) === String(data.id))
        if (!record) throw new NotFound()
        if (!(await authorizeResource(ctx, target, 'update', record))) throw new Forbidden()
        const row = record as unknown as Record<string, unknown>
        const from = String(row[options.statusColumn])
        if (rule && !(await rule(record, from, to, ctx))) throw new Forbidden()
        if (options.orderColumn) {
          const order = options.orderColumn
          const ordered = (status: string) =>
            rows
              .filter(
                (item) =>
                  item !== record &&
                  String((item as unknown as Record<string, unknown>)[options.statusColumn]) ===
                    status
              )
              .sort(
                (a, b) =>
                  Number((a as unknown as Record<string, unknown>)[order]) -
                  Number((b as unknown as Record<string, unknown>)[order])
              )
          const destination = ordered(to)
          destination.splice(Math.min(Number(data.position), destination.length), 0, record)
          const source = from === to ? [] : ordered(from)
          const changes = [source, destination].flatMap((column) =>
            column.flatMap((item, position) => {
              const current = item as unknown as Record<string, unknown>
              const statusChanges = item === record && from !== to
              if (Number(current[order]) === position && !statusChanges) return []
              return [{ item, position }]
            })
          )
          for (const { item } of changes) {
            if (item !== record && !(await authorizeResource(ctx, target, 'update', item)))
              throw new Forbidden()
          }
          for (const { item, position } of changes) {
            item.useTransaction(trx)
            item.merge({
              [order]: position,
              ...(item === record ? { [options.statusColumn]: to } : {}),
            })
            await item.save()
          }
        } else {
          record.useTransaction(trx)
          record.merge({ [options.statusColumn]: to })
          await record.save()
        }
      })
    })
  const widget = defineWidget(`kanban-${options.page.slug}`)
    .component('KanbanBoard', load)
    .actions([move])
    .span('full')
    .lazy(false)
    .canView(access)
  const page = definePage(options.page.slug)
    .title(options.page.label)
    .navigation({ label: options.page.label, group: options.page.navigationGroup })
    .canAccess(access)
    .widgets([widget])
  const requestContext = new AsyncLocalStorage<HttpContext>()
  const plugin = definePlugin({
    name: `kanban-${options.page.slug}`,
    pages: [options.page.icon ? page.icon(options.page.icon) : page],
    middleware: [(ctx, next) => requestContext.run(ctx, next)],
    extendResource(candidate) {
      if (candidate.slug !== definition.slug) return
      const amend = (
        nodes: NonNullable<typeof candidate.form>
      ): NonNullable<typeof candidate.form> =>
        nodes.map((node) => {
          if ('name' in node && node.name === options.statusColumn) {
            const previous = 'default' in node ? node.default : undefined
            return {
              ...node,
              default: () => {
                const status = requestContext.getStore()?.request.qs().kanbanStatus
                return typeof status === 'string' && values.includes(status)
                  ? status
                  : typeof previous === 'function'
                    ? previous()
                    : previous
              },
            }
          }
          if (node.kind === 'wizard')
            return {
              ...node,
              steps: node.steps.map((step) => ({ ...step, children: amend(step.children) })),
            }
          if ('children' in node && Array.isArray(node.children))
            return { ...node, children: amend(node.children) }
          return node
        })
      return { ...candidate, ...(candidate.form ? { form: amend(candidate.form) } : {}) }
    },
  })
  return { ...plugin, canMove: (next) => build(input, options, next) }
}
