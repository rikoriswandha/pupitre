import app from '@adonisjs/core/services/app'
import { HttpContext } from '@adonisjs/core/http'
import {
  action,
  actions,
  authorizeResource,
  createPupitreStorage,
  definePlugin,
  defineResource,
  lookupOrNull,
  panelRouteGroups,
  nav,
  pages,
  resolveAdapter,
  scopedQuery,
  table,
  t,
} from '@rikology/pupitre'
import type { PupitreConfig } from '@rikology/pupitre'
import Backup from './src/backup.js'
import { backupService } from './src/service.js'
export { BackupService, BackupBusy, dumpCommand, scrubBackupError } from './src/service.js'
export type { BackupRow, DumpConnection } from './src/service.js'
export { default as Backup } from './src/backup.js'
export { configure } from './configure.js'

export interface BackupOptions {
  disk: string
  directory: string
  connection?: string
  keep: { last?: number; days?: number }
  navigationGroup?: string
  authorize?: (
    ctx: HttpContext,
    ability: 'viewAny' | 'create' | 'view' | 'delete',
    record?: Backup
  ) => boolean | Promise<boolean>
  binaries?: { pgDump?: string; mysqldump?: string }
}

export async function authorizeBackup(
  ctx: HttpContext,
  options: BackupOptions,
  config: PupitreConfig,
  ability: 'viewAny' | 'create' | 'view' | 'delete',
  record?: Backup
) {
  if (
    ctx.pupitre?.panel.tenancy &&
    (!ctx.pupitre.tenant || (record && record.tenantId !== String(ctx.pupitre.tenant.id)))
  )
    return false
  if (options.authorize) return options.authorize(ctx, ability, record)
  const policies = await config.policies?.()
  const candidate = policies?.BackupPolicy
  const policy =
    candidate && typeof candidate === 'object' && 'default' in candidate
      ? candidate.default
      : candidate
  const bouncer = (
    ctx as HttpContext & {
      bouncer?: {
        with(value: typeof policy): { allows(ability: string, record?: Backup): Promise<boolean> }
      }
    }
  ).bouncer
  if (
    typeof policy !== 'function' ||
    !('prototype' in policy) ||
    typeof policy.prototype[ability] !== 'function' ||
    !bouncer
  )
    return false
  return bouncer.with(policy).allows(ability, record)
}

/** Server-only database backups; never grant ordinary tenant users access to full database dumps. */
export function backup(options: BackupOptions) {
  if (
    !options.disk ||
    !/^[a-zA-Z0-9_/-]+$/.test(options.directory) ||
    options.directory.split('/').includes('..') ||
    options.directory.startsWith('/')
  )
    throw new Error('Backup requires a disk and a safe relative directory')
  for (const value of [options.keep.last, options.keep.days])
    if (value !== undefined && (!Number.isInteger(value) || value < 1))
      throw new Error('Backup retention values must be positive integers')
  class Policy {
    static containerInjections = {
      _constructor: {
        dependencies: [HttpContext],
        createError: (message: string) => new Error(message),
      },
    }
    constructor(private ctx: HttpContext) {}
    async viewAny() {
      return authorizeBackup(
        this.ctx,
        options,
        await app.container.make('pupitre.config'),
        'viewAny'
      )
    }
    async create() {
      return authorizeBackup(
        this.ctx,
        options,
        await app.container.make('pupitre.config'),
        'create'
      )
    }
    async view(_user: unknown, record: Backup) {
      return authorizeBackup(
        this.ctx,
        options,
        await app.container.make('pupitre.config'),
        'view',
        record
      )
    }
    async delete(_user: unknown, record: Backup) {
      return (
        !record.activeLock &&
        !['pending', 'running'].includes(record.status) &&
        authorizeBackup(
          this.ctx,
          options,
          await app.container.make('pupitre.config'),
          'delete',
          record
        )
      )
    }
    update() {
      return false
    }
  }
  const resource = defineResource(Backup)
    .slug('backups')
    .label(t('Backup'))
    .pluralLabel(t('Backups'))
    .icon('database')
    .navigation({ group: options.navigationGroup ?? t('System') })
    .policy(Policy)
    .scope((query) => {
      query
        .where('disk', options.disk)
        .whereRaw("path LIKE ? ESCAPE '!'", [`${options.directory.replaceAll('_', '!_')}/%`])
    })
    .table((builder) =>
      builder
        .columns([
          table.text('id').label(t('Backup')),
          table.text('size').label(t('Size (bytes)')).numeric(),
          table
            .badge('status')
            .label(t('Status'))
            .options({
              pending: t('Pending'),
              running: t('Running'),
              completed: t('Completed'),
              failed: t('Failed'),
            }),
          table.text('startedAt').label(t('Started at')).since().sortable(),
          table
            .text('error')
            .label(t('Error'))
            .options({
              'Backup executable or source file is unavailable': t(
                'Backup executable or source file is unavailable'
              ),
              'Backup failed; inspect database and storage configuration': t(
                'Backup failed; inspect database and storage configuration'
              ),
              'Backup dispatch failed': t('Backup dispatch failed'),
            }),
        ])
        .defaultSort('startedAt', 'desc')
        .poll('5s')
    )
    .actions({
      header: [
        action('create-backup')
          .label(t('Create backup'))
          .can('create')
          .handle(async ({ ctx }) => {
            if (!ctx) throw new Error('Backup action requires HTTP context')
            const service = await backupService(options)
            const config = await app.container.make('pupitre.config')
            const jobs = await resolveAdapter(config.jobs)
            const row = await service.reserve(
              undefined,
              String(ctx.pupitre.user?.id ?? ''),
              ctx.pupitre.tenant ? String(ctx.pupitre.tenant.id) : undefined
            )
            if (jobs) {
              try {
                await jobs.dispatch(`pupitre.backup.${ctx.pupitre.panel.id}`, { id: row.id })
              } catch {
                await service.database.from('pupitre_backups').where('id', row.id).update({
                  status: 'failed',
                  active_lock: null,
                  error: 'Backup dispatch failed',
                  finished_at: new Date().toISOString(),
                })
                throw new Error('Backup dispatch failed')
              }
            } else await service.execute(row.id)
          })
          .after(({ refresh }) => refresh.table()),
      ],
      row: [
        action('download')
          .label(t('Download'))
          .openUrlInNewTab()
          .can('view')
          .visible(({ record }) => (record as Backup)?.status === 'completed')
          .url(
            ({ ctx, record }) =>
              `${ctx!.pupitre.panel.path}/_pupitre/backups/${encodeURIComponent(String((record as Backup).id))}/download`
          ),
        actions.delete(),
      ],
    })
    .beforeDelete(async (record) => {
      const service = await backupService(options)
      await service.drive.use(record.disk).delete(record.path)
    })
    .pages({ list: pages.list() })
  return definePlugin({
    name: 'backup',
    resources: [resource],
    navigation: [nav.group(options.navigationGroup ?? t('System')).items(['backups'])],
    async boot({ panel }) {
      const router = await app.container.make('router')
      panelRouteGroups(router, panel).tenant(() => {
        router
          .get('/_pupitre/backups/:id/download', async (ctx) => {
            const runtime = ctx.pupitre.panel.resources.find((item) => item.slug === 'backups')!
            if (!(await authorizeResource(ctx, runtime, 'viewAny'))) return ctx.response.forbidden()
            const id: unknown = ctx.params.id
            if (
              typeof id !== 'string' ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
            )
              return ctx.response.notFound()
            const record = (await lookupOrNull(() =>
              scopedQuery(ctx, runtime).where('id', id).first()
            )) as Backup | null
            if (!record) return ctx.response.notFound()
            if (!(await authorizeResource(ctx, runtime, 'view', record)))
              return ctx.response.forbidden()
            if (record.status !== 'completed') return ctx.response.conflict()
            const storage = createPupitreStorage(record.disk)
            if (!(await storage.exists(record.path))) return ctx.response.notFound()
            ctx.response
              .header('Content-Type', 'application/gzip')
              .header('X-Content-Type-Options', 'nosniff')
              .header('Content-Disposition', `attachment; filename="backup-${record.id}.gz"`)
            return ctx.response.stream(await storage.getStream(record.path))
          })
          .as('backups.download')
      })
      const config = await app.container.make('pupitre.config')
      const jobs = await resolveAdapter(config.jobs)
      if (jobs)
        jobs.register(`pupitre.backup.${panel.id}`, async (payload) => {
          if (typeof payload.id !== 'string') throw new Error('Invalid backup job')
          const service = await backupService(options)
          await service.execute(payload.id)
        })
      registeredBackups.set(panel.id, options)
    },
  })
}
export const registeredBackups = new Map<string, BackupOptions>()
export async function runBackup(options: BackupOptions, connection?: string) {
  const service = await backupService(options)
  return service.run(connection)
}
