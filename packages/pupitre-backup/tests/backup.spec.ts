import { test } from '@japa/runner'
import { definePanel } from '@rikology/pupitre'
import type { PupitreConfig } from '@rikology/pupitre'
import { ExceptionHandler, HttpContext } from '@adonisjs/core/http'
import type { DriveService } from '@adonisjs/drive/types'
import { readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { gunzip } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  backup,
  authorizeBackup,
  BackupService,
  BackupBusy,
  dumpCommand,
  scrubBackupError,
} from '../index.js'
import type { BackupOptions, Backup, BackupRow } from '../index.js'
import { createTestApp, closeTestApp, User } from '../../pupitre/tests/helpers/app.js'
import type { TestApplication } from '../../pupitre/tests/helpers/app.js'

const require = createRequire(import.meta.url)
const Sqlite = require('better-sqlite3')
const unzip = promisify(gunzip)
const options: BackupOptions = { disk: 'uploads', directory: 'backups', keep: { last: 2 } }
let app: TestApplication
let service: BackupService
let permitted = true
let recordPermitted = true

test.group('database backups', (group) => {
  group.setup(async () => {
    const panel = definePanel('admin')
      .path('/admin')
      .plugins([
        backup({
          ...options,
          authorize: (_ctx, ability) => permitted && (ability !== 'view' || recordPermitted),
        }),
      ])
    const tenantPanel = definePanel('tenant')
      .path('/tenant')
      .tenancy({
        mode: 'implicit',
        adapter: {
          async resolve() {
            return { id: 'one', name: 'One' }
          },
          scope(query, tenant, scopeOptions) {
            query.where(scopeOptions.ownership, tenant.id)
          },
          fill(data) {
            return data
          },
          async listForUser() {
            return [{ id: 'one', name: 'One' }]
          },
        },
      })
      .plugins([backup({ ...options, authorize: () => true })])
    app = await createTestApp({
      pupitre: { auth: { model: async () => ({ default: User }) } },
      panels: {
        admin: async () => ({ default: panel }),
        tenant: async () => ({ default: tenantPanel }),
        sessions: async () => ({
          default: definePanel('sessions')
            .path('/sessions')
            .login()
            .sessions()
            .plugins([backup({ ...options, authorize: () => true })]),
        }),
      },
      setup: async (router) => {
        class BindContext {
          handle(ctx: HttpContext, next: () => Promise<void>) {
            ctx.containerResolver.bindValue(HttpContext, ctx)
            return next()
          }
        }
        router.use([async () => ({ default: BindContext })])
      },
    })
    class DebugHandler extends ExceptionHandler {
      protected debug = true
    }
    const server = await app.app.container.make('server')
    server.errorHandler(async () => ({ default: DebugHandler }))
    await app.database.connection().schema.createTable('pupitre_backups', (table) => {
      table.uuid('id').primary()
      table.string('disk')
      table.string('path')
      table.bigInteger('size')
      table.string('status')
      table.text('error')
      table.string('connection')
      table.string('dialect')
      table.string('created_by')
      table.string('tenant_id')
      table.string('active_lock').unique()
      table.timestamp('started_at')
      table.timestamp('finished_at')
    })
    await app.database.connection().schema.createTable('pupitre_user_sessions', (table) => {
      table.string('id').primary()
      table.string('user_id')
      table.string('guard')
      table.string('panel')
      table.string('token_hash')
      table.string('remember_token_id')
      table.string('ip')
      table.string('user_agent', 512)
      table.timestamp('created_at')
      table.timestamp('last_active_at')
      table.timestamp('expires_at')
      table.boolean('remembered').notNullable().defaultTo(false)
      table.timestamp('revoked_at')
    })
    await app.database.connection().schema.createTable('pupitre_login_events', (table) => {
      table.increments('id')
      table.string('user_id')
      table.string('panel')
      table.string('event')
      table.string('method')
      table.string('ip')
      table.string('user_agent', 512)
      table.timestamp('created_at')
    })
    service = new BackupService(
      options,
      app.database,
      (await app.app.container.make('drive.manager')) as DriveService
    )
  })
  group.teardown(async () => {
    await app.database.connection().schema.dropTable('pupitre_backups')
    await app.database.connection().schema.dropTable('pupitre_user_sessions')
    await app.database.connection().schema.dropTable('pupitre_login_events')
    await closeTestApp(app)
  })
  group.each.setup(() => {
    permitted = true
    recordPermitted = true
  })

  test('panel route names build usable backup download URLs without a duplicated prefix', async ({
    assert,
  }) => {
    const router = await app.app.container.make('router')
    const id = await service.run()
    for (const panel of ['admin', 'tenant', 'sessions']) {
      const path = router.builder().params({ id }).make(`${panel}.backups.download`)
      assert.equal(path, `/${panel}/_pupitre/backups/${id}/download`)
      const response = await fetch(`${app.baseUrl}${path}`, { redirect: 'manual' })
      assert.equal(response.status, panel === 'admin' ? 200 : panel === 'tenant' ? 404 : 302)
    }
  })
  test('revoked browser sessions cannot download a completed backup', async ({ assert }) => {
    const user = await User.create({
      name: 'Backup operator',
      fullName: 'Backup operator',
      email: 'backup@example.test',
      password: 'password',
    })
    const login = await fetch(`${app.baseUrl}/sessions/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: user.email, password: 'password' }),
      redirect: 'manual',
    })
    assert.equal(login.status, 302, await login.text())
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ')
    const id = await service.run()
    const url = `${app.baseUrl}/sessions/_pupitre/backups/${id}/download`
    const allowed = await fetch(url, { headers: { Cookie: cookie }, redirect: 'manual' })
    assert.equal(allowed.status, 200, allowed.ok ? '' : await allowed.text())
    await app.database
      .from('pupitre_user_sessions')
      .where('user_id', String(user.id))
      .update({ revoked_at: new Date().toISOString() })
    const denied = await fetch(url, { headers: { Cookie: cookie }, redirect: 'manual' })
    assert.equal(denied.status, 302, await denied.text())
    assert.include(denied.headers.get('location')!, '/sessions/login')
    assert.notInclude(denied.headers.get('content-type') ?? '', 'gzip')
    const loggedOut = await fetch(url, { headers: { Cookie: cookie }, redirect: 'manual' })
    assert.equal(loggedOut.status, 302)
  })
  test('malformed 36-character UUIDs return 404 on every dialect', async ({ assert }) => {
    for (const id of ['-'.repeat(36), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa-']) {
      const response = await fetch(`${app.baseUrl}/admin/_pupitre/backups/${id}/download`)
      assert.equal(response.status, 404, await response.text())
    }
  })
  test('consistent SQLite snapshot round-trips a real row', async ({ assert }) => {
    await app.database.table('categories').insert({ name: 'Backup round-trip', tenant_id: 1 })
    const id = await service.run()
    const row = (await app.database.from('pupitre_backups').where('id', id).first()) as BackupRow
    assert.equal(row.status, 'completed')
    assert.isAbove(Number(row.size), 0)
    const copy = join(app.root, 'restored.sqlite')
    await writeFile(copy, await unzip(await readFile(join(app.storagePath, row.path))))
    const database = new Sqlite(copy, { readonly: true })
    try {
      assert.equal(
        database.prepare('select name from categories where name = ?').get('Backup round-trip')
          .name,
        'Backup round-trip'
      )
    } finally {
      database.close()
      await rm(copy)
    }
  }).skip(process.env.DB === 'pg')

  test('concurrent reservations return HTTP conflict and do not start a second dump', async ({
    assert,
  }) => {
    const row = await service.reserve()
    try {
      await assert.rejects(() => service.reserve(), BackupBusy)
      const response = await fetch(`${app.baseUrl}/admin/backups/actions/create-backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pupitre-Action': '1' },
        body: JSON.stringify({}),
      })
      assert.equal(response.status, 409, await response.text())
    } finally {
      await app.database.from('pupitre_backups').where('id', row.id).delete()
    }
  })

  test('private download checks resource and record authorization; delete removes the file', async ({
    assert,
  }) => {
    const id = await service.run()
    const row = (await app.database.from('pupitre_backups').where('id', id).first()) as BackupRow
    const url = `${app.baseUrl}/admin/_pupitre/backups/${id}/download`
    const allowed = await fetch(url)
    assert.equal(allowed.status, 200, allowed.ok ? '' : await allowed.text())
    assert.include(allowed.headers.get('content-disposition')!, 'attachment')
    const contents = await allowed.arrayBuffer()
    assert.isAbove(contents.byteLength, 0)
    recordPermitted = false
    const recordDenied = await fetch(url)
    assert.equal(recordDenied.status, 403)
    recordPermitted = true
    permitted = false
    const resourceDenied = await fetch(url)
    assert.equal(resourceDenied.status, 403)
    const deleteDenied = await fetch(`${app.baseUrl}/admin/backups/${id}`, {
      method: 'DELETE',
      headers: { 'X-Pupitre-Action': '1' },
    })
    assert.equal(deleteDenied.status, 403)
    const createDenied = await fetch(`${app.baseUrl}/admin/backups/actions/create-backup`, {
      method: 'POST',
      headers: { 'X-Pupitre-Action': '1', 'Content-Type': 'application/json' },
      body: '{}',
    })
    assert.equal(createDenied.status, 403)
    permitted = true
    const removed = await fetch(`${app.baseUrl}/admin/backups/${id}`, {
      method: 'DELETE',
      headers: { 'X-Pupitre-Action': '1' },
    })
    assert.equal(removed.status, 200)
    assert.isFalse(await service.drive.use(row.disk).exists(row.path))
  })
  test('another tenant cannot list, download, or delete backup metadata', async ({ assert }) => {
    const id = await service.run(undefined, 'system-admin', 'two')
    const download = await fetch(`${app.baseUrl}/tenant/_pupitre/backups/${id}/download`)
    assert.equal(download.status, 404)
    const deleted = await fetch(`${app.baseUrl}/tenant/backups/${id}`, {
      method: 'DELETE',
      headers: { 'X-Pupitre-Action': '1' },
    })
    assert.equal(deleted.status, 404)
    const response = await fetch(`${app.baseUrl}/tenant/backups`, {
      headers: { 'X-Inertia': 'true' },
    })
    const payload = (await response.json()) as { props: { data: { rows: { key: string }[] } } }
    assert.isFalse(payload.props.data.rows.some((row) => row.key === id))
    const row = (await app.database.from('pupitre_backups').where('id', id).first()) as BackupRow
    await service.remove(row)
  })

  test('retention removes old records and files only after successful backup', async ({
    assert,
  }) => {
    const first = await service.run()
    const row = (await app.database.from('pupitre_backups').where('id', first).first()) as BackupRow
    await app.database
      .from('pupitre_backups')
      .where('id', first)
      .update({ started_at: '2000-01-01T00:00:00.000Z' })
    await service.run()
    await service.run()
    assert.isNull(await app.database.from('pupitre_backups').where('id', first).first())
    assert.isFalse(await service.drive.use(row.disk).exists(row.path))
    const days = new BackupService({ ...options, keep: { days: 1 } }, app.database, service.drive)
    const old = (await app.database
      .from('pupitre_backups')
      .where('status', 'completed')
      .first()) as BackupRow
    await app.database
      .from('pupitre_backups')
      .where('id', old.id)
      .update({ started_at: '2000-01-01T00:00:00.000Z' })
    await days.run()
    assert.isNull(await app.database.from('pupitre_backups').where('id', old.id).first())
  })
  test('retention preserves fresh snapshots and does not match wildcard-like directories or other tenants', async ({
    assert,
  }) => {
    const underscored = new BackupService(
      { ...options, directory: 'backup_test', keep: { last: 1 } },
      app.database,
      service.drive
    )
    const adjacent = new BackupService(
      { ...options, directory: 'backupXtest', keep: { last: 1 } },
      app.database,
      service.drive
    )
    const first = await underscored.run()
    const otherDirectory = await adjacent.run()
    const otherTenant = await underscored.run(undefined, 'admin', 'two')
    await app.database
      .from('pupitre_backups')
      .where('id', first)
      .update({ started_at: '2099-01-01T00:00:00.000Z' })
    const fresh = await underscored.run()
    assert.isNull(await app.database.from('pupitre_backups').where('id', first).first())
    for (const id of [otherDirectory, otherTenant, fresh]) {
      const row = (await app.database.from('pupitre_backups').where('id', id).first()) as BackupRow
      assert.isNotNull(row)
      await service.remove(row)
    }
  })
  test('failed uploads scrub errors, release the durable lock, and preserve previous backups', async ({
    assert,
  }) => {
    const original = await service.run()
    const disk = service.drive.use(options.disk)
    const failingDrive = new Proxy(service.drive, {
      get(target, key) {
        if (key === 'use')
          return () =>
            new Proxy(disk, {
              get(storage, method) {
                if (method === 'putStream')
                  return async () => {
                    throw new Error('password=secret postgres://user:secret@host/db')
                  }
                const value = Reflect.get(storage, method)
                return typeof value === 'function' ? value.bind(storage) : value
              },
            })
        return Reflect.get(target, key)
      },
    })
    const failing = new BackupService({ ...options, keep: { last: 1 } }, app.database, failingDrive)
    const row = await failing.reserve()
    const beforeEntries = await readdir(tmpdir())
    const before = beforeEntries.filter((name) => name.startsWith('pupitre-backup-'))
    await assert.rejects(() => failing.execute(row.id), /Backup failed/)
    const afterEntries = await readdir(tmpdir())
    const after = afterEntries.filter((name) => name.startsWith('pupitre-backup-'))
    assert.sameMembers(after, before)
    const failed = await app.database.from('pupitre_backups').where('id', row.id).first()
    assert.equal(failed.status, 'failed')
    assert.notInclude(failed.error, 'secret')
    assert.isNull(failed.active_lock)
    assert.isFalse(await disk.exists(row.path))
    assert.isNotNull(await app.database.from('pupitre_backups').where('id', original).first())
    await service.run()
  })
})

test('MySQL command uses safe argument boundaries and environment-only password', ({ assert }) => {
  const command = dumpCommand(
    {
      client: 'mysql2',
      connection: {
        host: 'localhost',
        user: 'root',
        password: 'secret;$(touch /tmp/pwn)',
        database: 'test;drop database x',
        port: 3306,
      },
    },
    '/tmp/output',
    { mysqldump: '/opt/mysqldump' }
  )
  assert.equal(command.binary, '/opt/mysqldump')
  assert.include(command.args, '--single-transaction')
  assert.include(command.args, '--quick')
  assert.include(command.args, 'test;drop database x')
  assert.notInclude(command.args.join(' '), 'secret')
  assert.equal(command.env.MYSQL_PWD, 'secret;$(touch /tmp/pwn)')
  assert.isUndefined(command.env.PGPASSWORD)
})

test('errors never preserve credentials, process output or database URLs', ({ assert }) => {
  assert.notInclude(
    scrubBackupError(new Error('postgres://root:secret@host/db PASSWORD=secret')),
    'secret'
  )
  assert.notInclude(scrubBackupError({ code: 'secret', stderr: 'password=secret' }), 'secret')
  assert.include(scrubBackupError({ code: 'ENOENT' }), 'unavailable')
})

test('authorization fails closed and rejects another tenant before callback', async ({
  assert,
}) => {
  assert.isFalse(await authorizeBackup({} as HttpContext, options, {} as PupitreConfig, 'viewAny'))
  const ctx = { pupitre: { panel: { tenancy: {} }, tenant: { id: 'one' } } } as HttpContext
  assert.isFalse(
    await authorizeBackup(ctx, { ...options, authorize: () => true }, {} as PupitreConfig, 'view', {
      tenantId: 'two',
    } as Backup)
  )
})

let hasPgDump = false
try {
  execFileSync('pg_dump', ['--version'], { stdio: 'ignore' })
  hasPgDump = true
} catch {}
test('PostgreSQL custom dump is accepted by pg_restore', async ({ assert }) => {
  const config = {
    client: 'pg',
    connection: {
      host: '127.0.0.1',
      user: process.env.USER,
      database: process.env.PUPITRE_BACKUP_PG_DATABASE,
    },
  }
  if (!config.connection.database?.includes('test'))
    throw new Error('Set PUPITRE_BACKUP_PG_DATABASE to an isolated test database')
  const destination = join(process.env.TMPDIR ?? '/tmp', `pupitre-pg-${process.pid}.dump`)
  const command = dumpCommand(config, destination)
  try {
    execFileSync(command.binary, command.args, { env: command.env })
    assert.include(
      execFileSync('pg_restore', ['--list', destination], { encoding: 'utf8' }),
      'TABLE'
    )
  } finally {
    await rm(destination, { force: true })
  }
}).skip(!hasPgDump || !process.env.PUPITRE_BACKUP_PG_DATABASE)
