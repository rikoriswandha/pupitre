import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import { pruneExpiredExports } from '../../commands/prune.js'
import { User } from '../helpers/db.js'
import { setupDatabase, teardown, truncate } from '../helpers/db.js'

test.group('prune expired exports', (group) => {
  group.each.setup(async () => {
    await setupDatabase()
    await truncate()
  })
  group.teardown(async () => teardown())

  test('deletes expired export rows and preserves unexpired jobs', async ({ assert }) => {
    const database = await setupDatabase()
    const user = await User.create({ name: 'Export user', email: 'exports@example.test' })
    const now = DateTime.now()
    const expiredId = randomUUID()
    const activeId = randomUUID()
    await database.table('pupitre_exports').multiInsert([
      {
        id: expiredId,
        user_id: user.id,
        tenant_id: null,
        resource: 'posts',
        status: 'done',
        total_rows: 1,
        processed_rows: 1,
        file_key: null,
        error: null,
        created_at: now.toSQL(),
        updated_at: now.toSQL(),
        expires_at: now.minus({ minutes: 1 }).toSQL(),
      },
      {
        id: activeId,
        user_id: user.id,
        resource: 'posts',
        status: 'done',
        total_rows: 1,
        processed_rows: 1,
        file_key: null,
        error: null,
        created_at: now.toSQL(),
        updated_at: now.toSQL(),
        expires_at: now.plus({ minutes: 5 }).toSQL(),
      },
    ])

    assert.equal(await pruneExpiredExports(database), 1)
    const remaining = await database.from('pupitre_exports').count('* as total').first()
    assert.equal(Number(remaining?.total), 1)
    const active = await database
      .from('pupitre_exports')
      .where('id', activeId)
      .count('* as total')
      .first()
    assert.equal(Number(active?.total), 1)
  })
})
