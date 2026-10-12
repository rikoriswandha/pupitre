import { test } from '@japa/runner'
import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import { DateTime, Settings } from 'luxon'
import { defineValidationRules } from '../../../node_modules/@adonisjs/lucid/build/src/bindings/vinejs.js'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HttpContext } from '@adonisjs/core/http'
import type { PupitreConfig } from '@rikology/pupitre'
import {
  clearSettingsCache,
  defineSettings,
  settingsFor,
  saveSettings,
  Setting,
  authorizeSettings,
  settings,
} from '../index.js'
import { configure } from '../configure.js'
import { settingsApp } from './helpers/app.js'
import { teardown, Category } from '../../pupitre/tests/helpers/db.js'

const general = defineSettings('general')
  .form((s) => [
    s.text('name').required().maxLength(20),
    s.toggle('enabled'),
    s.number('count'),
    s.keyValue('metadata'),
  ])
  .defaults({ name: 'Default', enabled: false, count: 1, metadata: { color: 'blue' } })

test.group('typed settings', (suite) => {
  suite.teardown(teardown)
  test('settings upserts preserve timestamp instants in non-UTC sessions', async ({ assert }) => {
    const fixture = await settingsApp({ groups: [general], authorize: () => true })
    const database = await fixture.app.container.make('lucid.db')
    const previousNow = Settings.now
    const previousZone = Settings.defaultZone
    const instant = DateTime.fromISO('2026-10-12T10:00:00Z').toMillis()
    Settings.now = () => instant
    Settings.defaultZone = 'Asia/Jakarta'
    try {
      if (process.env.DB === 'pg')
        await database.connection().rawQuery("SET TIME ZONE 'Asia/Jakarta'")
      await saveSettings(general, { name: 'First' })
      Settings.now = () => instant + 60000
      await saveSettings(general, { name: 'Second' })
      const row = await Setting.query().where('group', 'general').where('key', 'name').firstOrFail()
      assert.equal(row.createdAt.toMillis(), instant)
      assert.equal(row.updatedAt.toMillis(), instant + 60000)
      const values = await settingsFor(general)
      assert.equal(values.name, 'Second')
    } finally {
      Settings.now = previousNow
      Settings.defaultZone = previousZone
      if (process.env.DB === 'pg') await database.connection().rawQuery('RESET TIME ZONE')
      await fixture.close()
    }
  })
  test('settings pages preserve host English validation messages', async ({ assert }) => {
    const provider = vine.messagesProvider
    vine.messagesProvider = new SimpleMessagesProvider({ required: 'Host requires {{ field }}' })
    const fixture = await settingsApp({ groups: [general], authorize: () => true })
    try {
      const response = await fetch(fixture.baseUrl + '/admin/settings', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({ ...general.defaultValues, name: '' }),
      })
      assert.equal(response.status, 422)
      assert.include(await response.text(), 'Host requires name')
    } finally {
      vine.messagesProvider = provider
      await fixture.close()
    }
  })
  test('generated page saves dates and non-idempotent dehydration exactly once', async ({
    assert,
  }) => {
    const transformed = defineSettings('transformed')
      .form((s) => [
        s.date('launch').required(),
        s
          .text('name')
          .required()
          .dehydrate((value) => `${value}!`),
      ])
      .defaults({ launch: '2026-10-12', name: 'Default' })
    const fixture = await settingsApp({ groups: [transformed], authorize: () => true })
    try {
      const response = await fetch(fixture.baseUrl + '/admin/settings-transformed', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({ launch: '2026-11-20', name: 'Saved' }),
      })
      assert.isBelow(response.status, 400)
      const values = await settingsFor(transformed)
      assert.equal(values.name, 'Saved!')
      assert.equal(values.launch, '2026-11-20T00:00:00.000Z')
    } finally {
      await fixture.close()
    }
  })
  test('database-backed select and unique validation save without holding the write connection', async ({
    assert,
  }) => {
    const backed = defineSettings('backed')
      .form((s) => [
        s
          .select('category')
          .required()
          .options(async () => {
            const categories = await Category.query()
            return Object.fromEntries(categories.map((row) => [String(row.id), row.name]))
          }),
        s.text('name').required().unique({ table: 'categories', column: 'name' }),
      ])
      .defaults({ category: '', name: 'Default' })
    const fixture = await settingsApp({ groups: [backed], authorize: () => true })
    const database = await fixture.app.container.make('lucid.db')
    defineValidationRules(database)
    const pool = database.manager.get(database.primaryConnectionName)!.connection!.pool!
    const timeout = pool.acquireTimeoutMillis
    pool.acquireTimeoutMillis = 500
    try {
      const category = await Category.create({ name: 'Available' })
      await saveSettings(backed, { category: String(category.id), name: 'Distinct' })
      const programmatic = await settingsFor(backed)
      assert.equal(programmatic.name, 'Distinct')
      const response = await fetch(fixture.baseUrl + '/admin/settings-backed', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({ category: String(category.id), name: 'Via page' }),
      })
      assert.isBelow(response.status, 400)
      const pageValues = await settingsFor(backed)
      assert.equal(pageValues.name, 'Via page')
    } finally {
      pool.acquireTimeoutMillis = timeout
      await fixture.close()
    }
  })
  test('concurrent first page saves succeed and leave one row per key', async ({ assert }) => {
    const fixture = await settingsApp({ groups: [general], authorize: () => true })
    try {
      const responses = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          fetch(fixture.baseUrl + '/admin/settings', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            redirect: 'manual',
            body: JSON.stringify({ ...general.defaultValues, name: `Writer ${index}` }),
          })
        )
      )
      for (const response of responses) assert.isBelow(response.status, 400)
      const rows = await Setting.query().where('group', general.name)
      assert.lengthOf(rows, 4)
      const values = await settingsFor(general)
      assert.match(values.name, /^Writer \d$/)
    } finally {
      await fixture.close()
    }
  })
  test('round trips booleans, numbers and JSON, merges defaults and ignores obsolete stored keys', async ({
    assert,
  }) => {
    const fixture = await settingsApp({ groups: [general], authorize: () => true })
    try {
      assert.deepEqual(await settingsFor(general), general.defaultValues)
      await saveSettings(general, { enabled: true, count: 12, metadata: { color: 'red' } })
      await Setting.create({
        group: 'general',
        scopeKey: 'global',
        key: 'obsolete',
        value: 'ignored',
      })
      assert.deepEqual(await settingsFor(general), {
        name: 'Default',
        enabled: true,
        count: 12,
        metadata: { color: 'red' },
      })
      await assert.rejects(
        () => saveSettings(general, { unknown: 'no' } as never),
        /Unknown settings key/
      )
      await assert.rejects(() => saveSettings(general, { name: 'This exceeds twenty characters' }))
      const afterInvalid = await settingsFor(general)
      assert.equal(afterInvalid.name, 'Default')
    } finally {
      await fixture.close()
    }
  })
  test('a database failure after the first write rolls back the entire patch', async ({
    assert,
  }) => {
    const fixture = await settingsApp({ groups: [general], authorize: () => true })
    try {
      await saveSettings(general, { name: 'Before', count: 2 })
      // A CHECK constraint fails only the second key, after the name write.
      await assert.rejects(() => saveSettings(general, { name: 'After', count: 99 }))
      const afterFailure = await settingsFor(general)
      assert.equal(afterFailure.name, 'Before')
      assert.equal(afterFailure.count, 2)
    } finally {
      await fixture.close()
    }
  })
  test('tenant groups isolate command reads and reject another active tenant', async ({
    assert,
  }) => {
    const tenantGroup = general.scope('tenant')
    const fixture = await settingsApp({ groups: [tenantGroup], authorize: () => true })
    try {
      await saveSettings(tenantGroup, { name: 'Acme' }, { tenant: { id: 'acme' } })
      await saveSettings(tenantGroup, { name: 'Globex' }, { tenant: { id: 'globex' } })
      const acme = await settingsFor(tenantGroup, { tenant: { id: 'acme' } })
      const globex = await settingsFor(tenantGroup, { tenant: { id: 'globex' } })
      assert.equal(acme.name, 'Acme')
      assert.equal(globex.name, 'Globex')
      await assert.rejects(() => settingsFor(tenantGroup), /active tenant/)
      const ctx = { pupitre: { tenant: { id: 'acme' } } } as HttpContext
      await assert.rejects(
        () => settingsFor(tenantGroup, { ctx, tenant: { id: 'globex' } }),
        /active tenant/
      )
      await assert.rejects(
        () => saveSettings(tenantGroup, { name: 'Intruder' }, { ctx, tenant: { id: 'globex' } }),
        /active tenant/
      )
    } finally {
      await fixture.close()
    }
  })
  test('generated page denies routes by default and explicitly allowed form persists values', async ({
    assert,
  }) => {
    let allowed = false
    const fixture = await settingsApp({ groups: [general], authorize: () => allowed })
    try {
      const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
      const denied = await fetch(fixture.baseUrl + '/admin/settings', { headers })
      assert.equal(denied.status, 403)
      allowed = true
      const permitted = await fetch(fixture.baseUrl + '/admin/settings', { headers })
      assert.equal(permitted.status, 200)
      const response = await fetch(fixture.baseUrl + '/admin/settings', {
        method: 'POST',
        headers,
        redirect: 'manual',
        body: JSON.stringify({
          name: 'From page',
          enabled: true,
          count: 4,
          metadata: { color: 'green' },
        }),
      })
      assert.isBelow(response.status, 400)
      const persisted = await settingsFor(general)
      assert.equal(persisted.name, 'From page')
    } finally {
      await fixture.close()
    }
  })
  test('cache is confined to each request, copied defensively and invalidated after save', async ({
    assert,
  }) => {
    const fixture = await settingsApp({ groups: [general], authorize: () => true })
    try {
      const ctx = {} as HttpContext
      const first = await settingsFor(general, { ctx })
      first.metadata.color = 'mutated'
      const cached = await settingsFor(general, { ctx })
      assert.equal(cached.metadata.color, 'blue')
      await saveSettings(general, { name: 'Saved' }, { ctx })
      const afterSave = await settingsFor(general, { ctx })
      assert.equal(afterSave.name, 'Saved')
      await Setting.query()
        .where('group', 'general')
        .where('key', 'name')
        .update({ value: JSON.stringify({ value: 'External' }) })
      const sameRequest = await settingsFor(general, { ctx })
      assert.equal(sameRequest.name, 'Saved')
      const newRequest = await settingsFor(general, { ctx: {} as HttpContext })
      assert.equal(newRequest.name, 'External')
      clearSettingsCache(ctx)
      const reloaded = await settingsFor(general, { ctx })
      assert.equal(reloaded.name, 'External')
    } finally {
      await fixture.close()
    }
  })
})

test('settings registration rejects missing defaults in nested writable fields', ({ assert }) => {
  const invalid = defineSettings('invalid').form((s) => [
    s.section('Nested').components([s.text('missing').required()]),
  ])
  assert.throws(
    () => settings({ groups: [invalid] }),
    /Settings group "invalid" requires a default for form field "missing"/
  )
  const valid = defineSettings('valid')
    .form((s) => [
      s.text('value'),
      s.text('display').dehydrated(false),
      s.placeholder('help').content('Help'),
      s.repeater('items').schema((fields) => [fields.text('nested')]),
    ])
    .defaults({ value: '', items: [] })
  assert.doesNotThrow(() => settings({ groups: [valid] }))
})

test('authorization fails closed and requires viewAny plus manage per group', async ({
  assert,
}) => {
  assert.isFalse(
    await authorizeSettings({} as HttpContext, general, { groups: [general] }, {} as PupitreConfig)
  )
  class SettingsPolicy {
    viewAny() {
      return true
    }
    manage() {
      return true
    }
  }
  const ctx = {
    bouncer: {
      with: () => ({
        allows: async (ability: string, value: unknown) =>
          ability === 'viewAny' || (ability === 'manage' && value === general),
      }),
    },
  } as unknown as HttpContext
  assert.isTrue(
    await authorizeSettings(ctx, general, { groups: [general] }, {
      policies: async () => ({ SettingsPolicy }),
    } as unknown as PupitreConfig)
  )
  const deniedCtx = {
    bouncer: { with: () => ({ allows: async (ability: string) => ability === 'manage' }) },
  } as unknown as HttpContext
  assert.isFalse(
    await authorizeSettings(deniedCtx, general, { groups: [general] }, {
      policies: async () => ({ SettingsPolicy }),
    } as unknown as PupitreConfig)
  )
})

test('configure publishes an idempotent migration without overwriting host edits', async ({
  assert,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'pupitre-settings-configure-'))
  const destination = join(
    directory,
    'database/migrations/1791700000043_create_pupitre_settings_table.ts'
  )
  let publishes = 0
  const command = {
    app: { makePath: (path: string) => join(directory, path) },
    createCodemods: async () => ({
      makeUsingStub: async (root: string, path: string) => {
        publishes++
        const source = await readFile(join(root, path), 'utf8')
        await mkdir(join(directory, 'database/migrations'), { recursive: true })
        await writeFile(destination, source.split('\n').slice(1).join('\n'))
      },
    }),
  }
  try {
    await configure(command as never)
    assert.include(await readFile(destination, 'utf8'), 'pupitre_settings')
    await writeFile(destination, 'host-edited')
    await configure(command as never)
    assert.equal(publishes, 1)
    assert.equal(await readFile(destination, 'utf8'), 'host-edited')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
