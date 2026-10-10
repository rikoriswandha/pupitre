import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { defineResource } from '../../index.js'
import { executeBuiltinDelete } from '../../src/compiler/action_compiler.js'
import { Post, setupDatabase, truncate } from '../helpers/db.js'

const ctx = {} as HttpContext

test.group('action integration', (group) => {
  group.each.setup(async () => {
    await setupDatabase()
    await truncate()
  })

  test('runs delete hooks transactionally for each selected record', async ({ assert }) => {
    const post = await Post.create({ title: 'Delete me', slug: 'delete-me', status: 'draft' })
    const another = await Post.create({
      title: 'Also delete',
      slug: 'also-delete',
      status: 'draft',
    })
    const events: string[] = []
    const resource = defineResource(Post)
      .beforeDelete((record) => {
        events.push(`before:${record.id}`)
      })
      .afterDelete((record) => {
        events.push(`after:${record.id}`)
      })
      .toDefinition()

    await executeBuiltinDelete(resource, [post, another], ctx)

    assert.deepEqual(events, [
      `before:${post.id}`,
      `after:${post.id}`,
      `before:${another.id}`,
      `after:${another.id}`,
    ])
    assert.lengthOf(await Post.all(), 0)
  })

  test('rolls back records when an after-delete hook fails', async ({ assert }) => {
    const post = await Post.create({ title: 'Keep me', slug: 'keep-me', status: 'draft' })
    const resource = defineResource(Post)
      .afterDelete(() => {
        throw new Error('hook failed')
      })
      .toDefinition()

    await assert.rejects(() => executeBuiltinDelete(resource, [post], ctx), /hook failed/)

    assert.exists(await Post.find(post.id))
  })
})
