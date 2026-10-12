import app from '@adonisjs/core/services/app'
import { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import Audit from '@rikology/adonisjs-audit-trail/models/audit'
import {
  actions,
  authorizeResource,
  definePlugin,
  defineResource,
  defineWidget,
  pages,
  nav,
  schema,
  resolveAdapter,
  scopedQuery,
  table,
  t,
} from '@rikology/pupitre'
import type { PupitreConfig, ResourceDefinition } from '@rikology/pupitre'

export interface AuditOptions {
  resources?: 'all' | string[]
  pages?: ('view' | 'edit')[]
  activity?: false | { slug?: string; navigationGroup?: string; label?: string }
  perPage?: number
  authorize?: (ctx: HttpContext, record?: Audit) => boolean | Promise<boolean>
}

/** The peer SQLite store writes ISO timestamps and assigns UUIDs itself. */
class ActivityAudit extends Audit {
  static table = Audit.table
  static selfAssignPrimaryKey = true

  @column.dateTime({
    consume: (value: unknown) => {
      if (DateTime.isDateTime(value)) return value
      if (value instanceof Date) return DateTime.fromJSDate(value, { zone: 'utc' })
      if (typeof value !== 'string') return DateTime.invalid('Invalid audit timestamp')
      const iso = DateTime.fromISO(value, { zone: 'utc' })
      return iso.isValid ? iso : DateTime.fromSQL(value, { zone: 'utc' })
    },
  })
  declare createdAt: DateTime
}

/** Activity access deliberately fails closed, unlike ordinary resource policy discovery. */
export async function authorizeActivity(
  ctx: HttpContext,
  options: AuditOptions,
  config: PupitreConfig,
  record?: Audit
): Promise<boolean> {
  if (ctx.pupitre?.panel.tenancy) {
    const tenant = ctx.pupitre.tenant
    if (!tenant || (record && record.tenantId !== String(tenant.id))) return false
  }
  if (options.authorize) return options.authorize(ctx, record)
  const policies = await config.policies?.()
  const candidate = policies?.AuditPolicy ?? policies?.ActivityPolicy
  const policy =
    candidate && typeof candidate === 'object' && 'default' in candidate
      ? candidate.default
      : candidate
  if (typeof policy !== 'function' || !('prototype' in policy)) return false
  const ability = record ? 'view' : 'viewAny'
  const bouncer = (
    ctx as HttpContext & {
      bouncer?: {
        with(value: typeof policy): { allows(ability: string, record?: Audit): Promise<boolean> }
      }
    }
  ).bouncer
  if (typeof policy.prototype[ability] !== 'function' || !bouncer) return false
  return bouncer.with(policy).allows(ability, record)
}

async function subjectUrl(
  ctx: HttpContext | undefined,
  type: unknown,
  id: unknown
): Promise<string | undefined> {
  if (!ctx || typeof type !== 'string' || (typeof id !== 'string' && typeof id !== 'number')) return
  const resource = ctx.pupitre.panel.resources.find(
    (candidate) =>
      candidate.model.name === type &&
      (candidate.definition.pages.view || candidate.definition.pages.edit)
  )
  if (!resource || resource.parent || !(await authorizeResource(ctx, resource, 'viewAny'))) return
  if (
    ctx.pupitre.panel.tenancy &&
    resource.definition.scope !== false &&
    (!ctx.pupitre.tenancyAdapter || !ctx.pupitre.tenant)
  )
    return
  const query = scopedQuery(ctx, resource)
  let subject: LucidRow | null
  try {
    subject = await query.where(resource.model.primaryKey, id).first()
  } catch (error) {
    // Historical morph IDs may no longer match the subject's PostgreSQL PK type.
    // Keep the audit entry visible, but never mask other lookup failures.
    if (error && typeof error === 'object' && 'code' in error && error.code === '22P02') return
    throw error
  }
  if (!subject || !(await authorizeResource(ctx, resource, 'view', subject))) return
  if (resource.definition.pages.view) return resource.urls.view(String(subject.$primaryKeyValue))
  if (await authorizeResource(ctx, resource, 'update', subject))
    return resource.urls.edit(String(subject.$primaryKeyValue))
}

function activityResource(options: AuditOptions) {
  const activity = options.activity || {}
  class ActivityPolicy {
    static containerInjections = {
      _constructor: {
        dependencies: [HttpContext],
        createError: (message: string) => new Error(message),
      },
    }
    constructor(private ctx: HttpContext) {}
    async viewAny() {
      return authorizeActivity(this.ctx, options, await app.container.make('pupitre.config'))
    }
    async view(_user: unknown, record: Audit) {
      return authorizeActivity(
        this.ctx,
        options,
        await app.container.make('pupitre.config'),
        record
      )
    }
    create() {
      return false
    }
    update() {
      return false
    }
    delete() {
      return false
    }
    restore() {
      return false
    }
    forceDelete() {
      return false
    }
    replicate() {
      return false
    }
  }
  return defineResource(ActivityAudit)
    .slug(activity.slug ?? 'activity')
    .label(activity.label ?? t('Activity'))
    .pluralLabel(activity.label ?? t('Activity'))
    .icon('activity')
    .navigation({ group: activity.navigationGroup ?? t('System') })
    .policy(ActivityPolicy)
    .recordTitle('event')
    .scope(false)
    .table((definition) =>
      definition
        .query((query, ctx) => {
          if (!ctx.pupitre.panel.tenancy) return
          if (!ctx.pupitre.tenant) query.whereRaw('1 = 0')
          else query.where('tenant_id', String(ctx.pupitre.tenant.id))
        })
        .columns([
          table.badge('event').label(t('Event')),
          table.text('auditableType').label(t('Subject')).searchable(),
          table
            .text('auditableId')
            .label(t('Subject ID'))
            .url(({ ctx, record }) => {
              const entry = record as Audit
              return subjectUrl(ctx, entry.auditableType, entry.auditableId)
            }),
          table.text('actorLabel').label(t('Actor')),
          table.text('createdAt').label(t('Time')).dateTime().sortable(),
        ])
        .filters([
          table.filter
            .custom('event')
            .form([schema.text('event').label(t('Event'))])
            .query((query, data) => {
              if (typeof data.event === 'string' && data.event) query.where('event', data.event)
            }),
          table.filter
            .custom('auditableType')
            .form([schema.text('subject').label(t('Subject type'))])
            .query((query, data) => {
              if (typeof data.subject === 'string' && data.subject)
                query.where('auditable_type', data.subject)
            }),
          table.filter
            .custom('createdAt')
            .form([
              schema.date('from').label(t('From (UTC)')),
              schema.date('to').label(t('Through (UTC)')),
            ])
            .query((query, data) => {
              if (typeof data.from === 'string' && data.from) {
                const from = DateTime.fromISO(data.from, { zone: 'utc' })
                if (from.isValid) query.where('created_at', '>=', from.startOf('day').toISO()!)
              }
              if (typeof data.to === 'string' && data.to) {
                const to = DateTime.fromISO(data.to, { zone: 'utc' })
                if (to.isValid)
                  query.where('created_at', '<', to.plus({ days: 1 }).startOf('day').toISO()!)
              }
            }),
        ])
        .defaultSort('createdAt', 'desc')
        .paginated([options.perPage ?? 25, 50, 100])
    )
    .infolist((s) => [
      s.textEntry('event').label(t('Event')),
      s.textEntry('auditableType').label(t('Subject')),
      s.textEntry('actorLabel').label(t('Actor')),
      s
        .textEntry('auditableId')
        .label(t('Subject ID'))
        .url(({ ctx, get }) => subjectUrl(ctx, get('auditableType'), get('auditableId'))),
      s.textEntry('actorType').label(t('Actor type')),
      s.textEntry('actorId').label(t('Actor ID')),
      s.textEntry('createdAt').label(t('Time')).dateTime(),
      s
        .section(t('Old values'))
        .components([
          s
            .placeholder('oldValues')
            .content(({ get }) => JSON.stringify(get('oldValues'), null, 2)),
        ]),
      s
        .section(t('New values'))
        .components([
          s
            .placeholder('newValues')
            .content(({ get }) => JSON.stringify(get('newValues'), null, 2)),
        ]),
    ])
    .actions({ row: [actions.view()] })
    .pages({ list: pages.list(), view: pages.view() })
}

/** Adds record timelines and a strictly read-only, explicitly authorized activity resource. */
export function audit(options: AuditOptions = {}) {
  const perPage = options.perPage ?? 25
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new Error('audit.perPage must be an integer between 1 and 100')
  }
  const activitySlug =
    options.activity === false ? undefined : (options.activity?.slug ?? 'activity')
  return definePlugin({
    name: 'audit',
    resources: options.activity === false ? [] : [activityResource(options)],
    navigation:
      options.activity === false
        ? []
        : [nav.group(options.activity?.navigationGroup ?? t('System')).items([activitySlug!])],
    extendResource(resource: ResourceDefinition<LucidRow>) {
      if (
        resource.slug === activitySlug ||
        (options.resources !== undefined &&
          options.resources !== 'all' &&
          !options.resources.includes(resource.slug))
      )
        return
      const nextPages = { ...resource.pages }
      for (const page of options.pages ?? ['view', 'edit']) {
        const definition = nextPages[page]
        if (!definition) continue
        const timeline = defineWidget(`audit-${resource.slug}`)
          .timeline(async ({ ctx, record }) => {
            if (
              !record ||
              !resource.modelClass ||
              (record as LucidRow).$primaryKeyValue === undefined
            )
              return []
            if (ctx.pupitre.panel.tenancy && !ctx.pupitre.tenant) return []
            const config = await app.container.make('pupitre.config')
            const adapter = await resolveAdapter(config.audit)
            if (!adapter) throw new Error('The audit plugin requires config.pupitre.audit')
            const result = await adapter.forRecord(
              resource.modelClass,
              (record as LucidRow).$primaryKeyValue!,
              {
                page: 1,
                perPage,
                ...(ctx.pupitre.panel.tenancy ? { tenantId: String(ctx.pupitre.tenant!.id) } : {}),
              }
            )
            return result.items.map((entry) => ({
              title: entry.event,
              time: entry.createdAt,
              actor: entry.actor?.label ?? entry.actor?.id ?? entry.actor?.type,
              changes: entry.changes,
            }))
          })
          .heading(t('Activity'))
          .span('full')
          .toDefinition()
        nextPages[page] = {
          ...definition,
          footerWidgets: [...(definition.footerWidgets ?? []), timeline],
        }
      }
      return { ...resource, pages: nextPages }
    },
  })
}
