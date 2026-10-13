import app from '@adonisjs/core/services/app'
import { createError } from '@adonisjs/core/exceptions'
import { t } from '@rikology/pupitre'
import type { Database } from '@adonisjs/lucid/database'
import type { DriveService } from '@adonisjs/drive/types'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { PassThrough, Transform } from 'node:stream'
import type { BackupOptions } from '../index.js'

export const BackupBusy = createError(
  t('A backup is already running'),
  'E_PUPITRE_BACKUP_BUSY',
  409
)
export type BackupRow = {
  id: string
  disk: string
  path: string
  size: number
  status: string
  connection: string
  dialect: string
  tenant_id: string | null
  created_by: string | null
  started_at: string
  finished_at: string | null
  error: string | null
}
export type DumpConnection = {
  client: string
  connection:
    | string
    | {
        filename?: string
        host?: string
        port?: number
        user?: string
        password?: string
        database?: string
        ssl?: unknown
      }
}

/** Only arguments, never a shell or a password-bearing URL. */
export function dumpCommand(
  config: DumpConnection,
  destination: string,
  binaries: BackupOptions['binaries'] = {}
) {
  const url = typeof config.connection === 'string' ? new URL(config.connection) : undefined
  const value =
    typeof config.connection === 'string'
      ? {
          host: url!.hostname,
          port: url!.port ? Number(url!.port) : undefined,
          user: decodeURIComponent(url!.username),
          password: decodeURIComponent(url!.password),
          database: decodeURIComponent(url!.pathname.slice(1)),
          ssl: url!.searchParams.get('sslmode') === 'require',
        }
      : config.connection
  const env = { ...process.env }
  delete env.PGPASSWORD
  delete env.MYSQL_PWD
  const postgres = ['pg', 'postgres', 'postgresql'].includes(config.client)
  const args = postgres
    ? ['--format=custom', '--file', destination, '--no-password']
    : ['--single-transaction', '--quick', '--result-file', destination]
  if (value.host) args.push('--host', value.host)
  if (value.port) args.push('--port', String(value.port))
  if (value.user) args.push(postgres ? '--username' : '--user', value.user)
  if (value.password) env[postgres ? 'PGPASSWORD' : 'MYSQL_PWD'] = value.password
  if (postgres && value.ssl) env.PGSSLMODE = 'require'
  if (value.database) args.push(postgres ? '--dbname' : '--databases', value.database)
  return {
    binary: postgres ? (binaries.pgDump ?? 'pg_dump') : (binaries.mysqldump ?? 'mysqldump'),
    args,
    env,
  }
}

/** Persist no process output: it may contain credentials, SQL, or connection URLs. */
export function scrubBackupError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  return code === 'ENOENT'
    ? 'Backup executable or source file is unavailable'
    : 'Backup failed; inspect database and storage configuration'
}

export class BackupService {
  constructor(
    readonly options: BackupOptions,
    readonly database: Database,
    readonly drive: DriveService
  ) {}
  async reserve(connection?: string, actor?: string, tenant?: string): Promise<BackupRow> {
    const name = connection ?? this.options.connection ?? this.database.primaryConnectionName
    const config = this.database.getRawConnection(name)?.config as DumpConnection
    if (
      !config ||
      !['sqlite', 'better-sqlite3', 'pg', 'postgres', 'postgresql', 'mysql', 'mysql2'].includes(
        config.client
      )
    )
      throw new Error('Unsupported backup database connection')
    const row: BackupRow = {
      id: randomUUID(),
      disk: this.options.disk,
      path: `${this.options.directory}/${randomUUID()}.${config.client === 'pg' ? 'dump' : config.client.includes('sqlite') ? 'sqlite' : 'sql'}.gz`,
      size: 0,
      status: 'pending',
      connection: name,
      dialect: config.client,
      tenant_id: tenant ?? null,
      created_by: actor ?? null,
      started_at: new Date().toISOString(),
      finished_at: null,
      error: null,
    }
    try {
      await this.database.table('pupitre_backups').insert({ ...row, active_lock: 'active' })
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (['23505', 'SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT', 'ER_DUP_ENTRY'].includes(code))
        throw new BackupBusy()
      throw error
    }
    return row
  }
  async run(connection?: string, actor?: string, tenant?: string) {
    const row = await this.reserve(connection, actor, tenant)
    await this.execute(row.id)
    return row.id
  }
  async execute(id: string) {
    const claimed = await this.database
      .from('pupitre_backups')
      .where('id', id)
      .where('status', 'pending')
      .update({ status: 'running' })
    if (!Number(claimed)) return
    const row = (await this.database.from('pupitre_backups').where('id', id).first()) as BackupRow
    let temporary: string | undefined
    try {
      temporary = await mkdtemp(join(tmpdir(), 'pupitre-backup-'))
      const dump = join(temporary, 'snapshot')
      const config = this.database.getRawConnection(row.connection)?.config as DumpConnection
      if (config.client.includes('sqlite'))
        await this.database.connection(row.connection).rawQuery('VACUUM INTO ?', [dump])
      else {
        const command = dumpCommand(config, dump, this.options.binaries)
        await new Promise<void>((resolve, reject) => {
          execFile(
            command.binary,
            command.args,
            { env: command.env, maxBuffer: 1024 * 1024 },
            (error) => (error ? reject(error) : resolve())
          )
        })
      }
      let size = 0
      const output = new PassThrough()
      const counter = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          size += chunk.length
          done(null, chunk)
        },
      })
      const streaming = pipeline(createReadStream(dump), createGzip(), counter, output)
      const upload = this.drive
        .use(row.disk)
        .putStream(row.path, output, { visibility: 'private', contentType: 'application/gzip' })
      try {
        await Promise.all([streaming, upload])
      } catch (error) {
        output.destroy(error instanceof Error ? error : new Error('Backup upload failed'))
        await Promise.allSettled([streaming, upload])
        throw error
      }
      await this.database
        .from('pupitre_backups')
        .where('id', id)
        .update({ status: 'completed', size, finished_at: new Date().toISOString() })
    } catch (error) {
      try {
        await this.drive.use(row.disk).delete(row.path)
      } catch {
        // A failed disk must not prevent recording the scrubbed failure and releasing the lock.
      }
      await this.database
        .from('pupitre_backups')
        .where('id', id)
        .update({
          status: 'failed',
          error: scrubBackupError(error),
          finished_at: new Date().toISOString(),
          active_lock: null,
        })
      throw new Error(scrubBackupError(error))
    } finally {
      if (temporary) await rm(temporary, { recursive: true, force: true })
    }
    try {
      await this.retain(row)
    } catch (error) {
      throw new Error(scrubBackupError(error))
    } finally {
      await this.database.from('pupitre_backups').where('id', id).update({ active_lock: null })
    }
  }
  async remove(row: BackupRow) {
    await this.drive.use(row.disk).delete(row.path)
    await this.database.from('pupitre_backups').where('id', row.id).delete()
  }
  async retain(current: BackupRow) {
    const query = this.database
      .from('pupitre_backups')
      .where('status', 'completed')
      .whereNot('id', current.id)
      .where('disk', current.disk)
      .where('connection', current.connection)
      .whereRaw("path LIKE ? ESCAPE '!'", [`${this.options.directory.replaceAll('_', '!_')}/%`])
      .orderBy('started_at', 'desc')
    if (current.tenant_id === null) query.whereNull('tenant_id')
    else query.where('tenant_id', current.tenant_id)
    const rows = (await query) as BackupRow[]
    const cutoff =
      this.options.keep.days === undefined
        ? undefined
        : Date.now() - this.options.keep.days * 86400000
    for (const [index, row] of rows.entries()) {
      if (
        (this.options.keep.last !== undefined && index >= this.options.keep.last - 1) ||
        (cutoff !== undefined && new Date(row.started_at).getTime() < cutoff)
      )
        await this.remove(row)
    }
  }
}
export async function backupService(options: BackupOptions) {
  return new BackupService(
    options,
    await app.container.make('lucid.db'),
    await app.container.make('drive.manager')
  )
}
