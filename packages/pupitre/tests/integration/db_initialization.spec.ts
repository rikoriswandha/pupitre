import { test } from '@japa/runner'
import { setupDatabase, teardown } from '../helpers/db.js'
import { up as migrateRelations } from '../fixtures/migrations/140_relations.js'

test.group('database fixture initialization', (group) => {
  group.teardown(() => teardown())

  test('concurrent callers wait for the complete schema', async ({ assert }) => {
    await teardown()
    const pending = setupDatabase()
    try {
      const second = await setupDatabase()
      assert.isTrue(await second.connection().schema.hasTable('relation_revisions'))
      assert.strictEqual(await pending, second)
    } finally {
      await pending
    }
  })

  test('relation migrations are repeatable without replaying foreign keys', async ({ assert }) => {
    const db = await setupDatabase()
    await migrateRelations(db)
    await migrateRelations(db)
    await assert.rejects(async () => {
      await db.connection().table('relation_revisions').insert({
        post_id: 2147483647,
        title: 'Orphan',
        body: 'Orphan',
      })
    })
  })
})
