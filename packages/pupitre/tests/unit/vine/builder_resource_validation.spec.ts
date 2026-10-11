import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { schema } from '../../../src/builder/schema/schema.js'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'
import { valuesAt } from '../../../src/definition/values_at.js'

const nodes = [
  schema
    .builder('content')
    .blocks([
      schema.block('hero').schema([schema.fileUpload('image').required()]),
      schema
        .block('gallery')
        .schema([schema.repeater('items').schema([schema.fileUpload('image')])]),
    ])
    .toDefinition(),
]

function context(form = nodes): HttpContext {
  return {
    session: {
      get: () => [
        { key: 'hero.png', resource: 'posts', field: 'content.hero.data.image', ability: 'create' },
        {
          key: 'gallery.png',
          resource: 'posts',
          field: 'content.gallery.data.items.image',
          ability: 'create',
        },
      ],
    },
    pupitre: { panel: { resources: [{ slug: 'posts', definition: { form } }] } },
  } as unknown as HttpContext
}

test.group('Builder resource validation metadata', () => {
  test('accepts uploads at full block paths, including nested repeaters', async ({ assert }) => {
    const input = {
      content: [
        { type: 'hero', data: { image: 'hero.png' } },
        { type: 'gallery', data: { items: [{ image: 'gallery.png' }] } },
      ],
    }
    assert.deepEqual(
      await compileValidator(nodes).validate(input, { timezone: 'UTC', ctx: context() }),
      input
    )
    assert.deepEqual(valuesAt(input, 'content.hero.data.image'), ['hero.png'])
    assert.deepEqual(valuesAt(input, 'content.gallery.data.items.image'), ['gallery.png'])
  })

  test('retains only persisted files from the matching block and rejects cross-block keys', async ({
    assert,
  }) => {
    const record = {
      serialize: () => ({ content: [{ type: 'hero', data: { image: 'old.png' } }] }),
    } as unknown as LucidRow
    const validator = compileValidator(nodes)
    const opts = { timezone: 'UTC', ctx: context(), record }
    await validator.validate({ content: [{ type: 'hero', data: { image: 'old.png' } }] }, opts)
    for (const image of ['gallery.png', 'forged.png']) {
      await assert.rejects(() =>
        validator.validate({ content: [{ type: 'hero', data: { image } }] }, opts)
      )
    }
  })

  test('keeps cached block validators isolated by full parent path', async ({ assert }) => {
    const block = schema.block('hero').schema([schema.fileUpload('image')])
    const form = [
      schema.builder('content').blocks([block]).toDefinition(),
      schema.builder('other').blocks([block]).toDefinition(),
    ]
    const ctx = context(form)
    const validator = compileValidator(form)
    await validator.validate(
      { content: [{ type: 'hero', data: { image: 'hero.png' } }] },
      { timezone: 'UTC', ctx }
    )
    await assert.rejects(() =>
      validator.validate(
        { other: [{ type: 'hero', data: { image: 'hero.png' } }] },
        { timezone: 'UTC', ctx }
      )
    )
  })

  test('traverses builders nested in repeaters and selects only matching block types', ({
    assert,
  }) => {
    const input = {
      sections: [
        {
          content: [
            { type: 'hero', data: { image: 'a.png' } },
            { type: 'text', data: { image: 'not-an-upload.png' } },
          ],
        },
        { content: [{ type: 'hero', data: { image: 'b.png' } }] },
      ],
    }
    assert.deepEqual(valuesAt(input, 'sections.content.hero.data.image'), ['a.png', 'b.png'])
  })
})
