import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type { HealthChecks } from '@adonisjs/core/health'
import {
  action,
  definePage,
  definePlugin,
  defineWidget,
  nav,
  stat,
  table,
  t,
} from '@rikology/pupitre'
import type { PupitreConfig } from '@rikology/pupitre'
import { HealthRunner } from './src/runner.js'
export { HealthRunner, safeHealthMeta } from './src/runner.js'
export type { HealthSnapshot, HealthStatus } from './src/runner.js'
export { configure } from './configure.js'

export type HealthOptions = {
  checks: HealthChecks
  navigationGroup?: string
  authorize?: (ctx: HttpContext) => boolean | Promise<boolean>
  cacheSeconds?: number
  page?: { slug?: string; label?: string; icon?: string }
}

export async function authorizeHealth(
  ctx: HttpContext,
  options: Pick<HealthOptions, 'authorize'>,
  config: PupitreConfig
): Promise<boolean> {
  if (options.authorize) return (await options.authorize(ctx)) === true
  const policies = await config.policies?.()
  const candidate = policies?.HealthPolicy
  const policy =
    candidate && typeof candidate === 'object' && 'default' in candidate
      ? candidate.default
      : candidate
  if (
    typeof policy !== 'function' ||
    !('prototype' in policy) ||
    typeof policy.prototype.view !== 'function'
  )
    return false
  const bouncer = (
    ctx as HttpContext & {
      bouncer?: { with(value: typeof policy): { allows(ability: string): Promise<boolean> } }
    }
  ).bouncer
  return bouncer ? bouncer.with(policy).allows('view') : false
}

/** Protected infrastructure dashboard backed by the host's Adonis HealthChecks. */
export function health(options: HealthOptions) {
  const runner = new HealthRunner(options.checks, options.cacheSeconds)
  const slug = options.page?.slug ?? 'health'
  const allow = async (ctx: HttpContext) =>
    authorizeHealth(ctx, options, await app.container.make('pupitre.config'))
  const summary = defineWidget(`${slug}-summary`)
    .heading(t('Application health'))
    .canView(allow)
    .stats(async ({ ctx }) => {
      const report = await runner.run()
      const lastRun = DateTime.fromISO(report.finishedAt)
        .setZone(ctx.pupitre?.timezone ?? 'UTC')
        .setLocale(ctx.pupitre?.locale ?? 'en')
        .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)
      return [
        stat(
          t('Overall status'),
          report.status === 'ok'
            ? t('Healthy')
            : report.status === 'warning'
              ? t('Warning')
              : t('Error')
        ),
        stat(t('Healthy'), report.counts.ok).color('success'),
        stat(t('Warning'), report.counts.warning).color('warning'),
        stat(t('Error'), report.counts.error).color('danger'),
        stat(t('Last run'), lastRun),
      ]
    })
  const results = defineWidget(`${slug}-results`)
    .heading(t('Check results'))
    .span('full')
    .canView(allow)
    .table((builder) =>
      builder
        .records(async ({ page, perPage }) => {
          const report = await runner.run()
          const size = perPage === 'all' ? report.rows.length : perPage
          return {
            rows: report.rows.slice((page - 1) * size, page * size),
            total: report.rows.length,
          }
        })
        .columns([
          table.text('name').label(t('Check')),
          // Badge carries the status as text and color; no separate icon-only column.
          table
            .badge('status')
            .label(t('Status'))
            .options([
              { value: 'ok', label: t('Healthy') },
              { value: 'warning', label: t('Warning') },
              { value: 'error', label: t('Error') },
            ])
            .colors({ ok: 'success', warning: 'warning', error: 'danger' }),
          table.text('message').label(t('Message')),
          table.text('measurements').label(t('Measurements')),
        ])
        .paginated([10, 25, 50])
    )
  const page = definePage(slug)
    .title(options.page?.label ?? t('Health'))
    .icon(options.page?.icon ?? 'activity')
    .canAccess(allow)
    .widgets([summary, results])
    .actions([
      action('run-checks')
        .label(t('Run checks'))
        .icon('refresh-cw')
        .handle(async () => {
          await runner.run(true)
        }),
    ])
  return definePlugin({
    name: 'health',
    pages: [page],
    navigation: [
      nav.group(options.navigationGroup ?? t('Administration')).items([nav.item().page(slug)]),
    ],
  })
}
