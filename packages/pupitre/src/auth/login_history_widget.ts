import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { PupitreConfig } from '../define_config.js'
import type { PolicyClass } from '../definition/resource.js'
import { defineWidget } from '../builder/widget.js'
import { table as columns } from '../builder/table/table.js'
import { resolveResourcePolicy } from '../authz/bouncer.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import { sessionDatabase } from './session_service.js'
import { t } from '../i18n.js'

async function historyAllowed(ctx: HttpContext, record: unknown) {
  if (
    !record ||
    typeof record !== 'object' ||
    !('$primaryKeyValue' in record) ||
    !ctx.pupitre.panel.sessions?.history
  )
    return false
  const resource = ctx.pupitre.panel.resources.find(
    (candidate) => candidate.model === (record as LucidRow).constructor
  )
  if (!resource) return false
  const cfg = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
  const policy = await resolveResourcePolicy(resource, cfg)
  if (
    !policy ||
    typeof (policy.prototype as Record<string, unknown>).viewLoginHistory !== 'function'
  )
    return false
  const bouncer = (
    ctx as HttpContext & {
      bouncer?: {
        with(value: PolicyClass): { allows(ability: string, record: LucidRow): Promise<boolean> }
      }
    }
  ).bouncer
  return bouncer ? bouncer.with(policy).allows('viewLoginHistory', record as LucidRow) : false
}
/** Record-aware User view widget. Requires an explicit viewLoginHistory policy ability. */
export function loginHistoryWidget() {
  return defineWidget('login-history')
    .heading(t('Login history'))
    .table((table) =>
      table
        .records(async ({ ctx, page, perPage, record }) => {
          if (!(await historyAllowed(ctx, record))) throw new E_PUPITRE_FORBIDDEN()
          const user = record as LucidRow
          const db = await sessionDatabase(ctx)
          const query = db
            .from('pupitre_login_events')
            .where('user_id', String(user.$primaryKeyValue))
            .where('panel', ctx.pupitre.panel.id)
          const count = await query.clone().count('* as total').first()
          const rowsQuery = query.orderBy('created_at', 'desc').orderBy('id', 'desc')
          if (perPage !== 'all') rowsQuery.offset((page - 1) * perPage).limit(perPage)
          const rows = await rowsQuery.select('id', 'event', 'method', 'ip', 'created_at')
          return { rows, total: Number(count?.total ?? 0) }
        })
        .columns([
          columns.text('event').label(t('Event')),
          columns.text('method').label(t('Method')),
          columns.text('ip').label('IP'),
          columns.text('created_at').label(t('Date')),
        ])
    )
}
