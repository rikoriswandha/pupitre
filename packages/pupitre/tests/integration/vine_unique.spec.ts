import { test } from '@japa/runner'
import { defineValidationRules } from '../../../../node_modules/@adonisjs/lucid/build/src/bindings/vinejs.js'
import { schema } from '../../src/builder/schema/schema.js'
import { compileValidator } from '../../src/compiler/vine_compiler.js'
import { setupDatabase, teardown, truncate, seed, Post } from '../helpers/db.js'
async function captureError(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    await operation()
  } catch (error) {
    return error
  }
  throw new Error('Expected validation to fail')
}

function validationFields(error: unknown): string[] {
  if (
    !error ||
    typeof error !== 'object' ||
    !('messages' in error) ||
    !Array.isArray(error.messages)
  )
    return []
  return error.messages.flatMap((message) =>
    message &&
    typeof message === 'object' &&
    'field' in message &&
    typeof message.field === 'string'
      ? [message.field]
      : []
  )
}

test.group('Vine Lucid rules', (group) => {
  group.each.setup(async () => {
    // Lucid binds the rules to one Database instance; each test gets a fresh one.
    defineValidationRules(await setupDatabase())
    await truncate()
  })
  group.each.teardown(async () => teardown())

  test('checks unique values, ignores the current record, and verifies exists', async ({
    assert,
  }) => {
    const { posts, users } = await seed({
      users: [{ name: 'Ada', email: 'ada@example.com' }],
      posts: [{ title: 'Existing', slug: 'existing', status: 'draft' }],
    })
    const post = posts[0]
    const validator = compileValidator([
      schema
        .text('slug')
        .unique({ table: 'posts', column: 'slug', ignoreRecord: true })
        .toDefinition(),
      schema.text('authorId').exists({ table: 'users', column: 'id' }).toDefinition(),
    ])

    const error = await captureError(() =>
      validator.validate({ slug: 'existing', authorId: String(users[0].id) }, { timezone: 'UTC' })
    )
    assert.isTrue(validationFields(error).includes('slug'))

    const updated = await validator.validate(
      { slug: 'existing', authorId: String(users[0].id) },
      { timezone: 'UTC', record: post }
    )
    assert.equal(updated.slug, 'existing')
    await assert.rejects(() =>
      validator.validate({ slug: 'new', authorId: '9999' }, { timezone: 'UTC' })
    )
  })

  test('unique without an explicit table uses the resource model on create and update', async ({
    assert,
  }) => {
    const { posts } = await seed({
      posts: [{ title: 'Existing', slug: 'existing', status: 'draft' }],
    })
    const validator = compileValidator([
      schema.text('slug').unique({ ignoreRecord: true }).toDefinition(),
    ])
    const error = await captureError(() =>
      validator.validate({ slug: 'existing' }, { timezone: 'UTC', model: Post })
    )
    assert.deepEqual(validationFields(error), ['slug'])
    const updated = await validator.validate(
      { slug: 'existing' },
      { timezone: 'UTC', model: Post, record: posts[0] }
    )
    assert.equal(updated.slug, 'existing')
  })
})
