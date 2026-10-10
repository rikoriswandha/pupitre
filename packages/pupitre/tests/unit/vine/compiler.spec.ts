import { test } from '@japa/runner'
import vine from '@vinejs/vine'
import { schema } from '../../../src/builder/schema/schema.js'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'
import type { FieldDefinitionUnion, SchemaNodeDefinition } from '../../../src/definition/schema.js'

const field = (builder: { toDefinition(): unknown }) =>
  builder.toDefinition() as FieldDefinitionUnion
const options = { timezone: 'Asia/Jakarta' }
async function captureError(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    await operation()
  } catch (error) {
    return error
  }
  throw new Error('Expected validation to fail')
}

function errorFields(error: unknown): string[] {
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

test.group('Vine compiler', () => {
  test('compiles each definition array once', ({ assert }) => {
    const nodes = [field(schema.text('name'))] as SchemaNodeDefinition[]
    const original = vine.compile
    let calls = 0
    Object.defineProperty(vine, 'compile', {
      configurable: true,
      value: ((...args: Parameters<typeof original>) => {
        calls += 1
        return original.call(vine, ...args)
      }) as typeof original,
    })
    try {
      assert.strictEqual(compileValidator(nodes), compileValidator(nodes))
      assert.equal(calls, 1)
    } finally {
      Object.defineProperty(vine, 'compile', { configurable: true, value: original })
    }
  })

  test('validates required, optional, nullable and basic string rules', async ({ assert }) => {
    const nodes = [
      field(schema.text('required').required()),
      field(schema.text('optional')),
      field(schema.text('nullable').nullable()),
      field(schema.text('email').email()),
      field(schema.text('slug').alphaNumeric()),
    ] as SchemaNodeDefinition[]
    const validator = compileValidator(nodes)
    const error = await captureError(() => validator.validate({}, options))
    assert.deepEqual(errorFields(error), ['required'])
    const result = await validator.validate(
      { required: 'ok', nullable: null, email: 'x@y.com', slug: 'ok1', ignored: true },
      options
    )
    assert.deepEqual(result, { required: 'ok', nullable: null, email: 'x@y.com', slug: 'ok1' })
    await assert.rejects(() =>
      validator.validate({ required: 'ok', email: 'no', slug: 'bad-' }, options)
    )
  })

  test('validates numeric, enum, arrays, tags, key-values and file limits', async ({ assert }) => {
    const nodes = [
      field(schema.number('quantity').min(1).max(5).step(0.5)),
      field(schema.select('status').options({ draft: 'Draft', published: 'Published' })),
      field(schema.multiSelect('roles').options({ editor: 'Editor', author: 'Author' })),
      field(schema.tags('tags').maxTags(2)),
      field(schema.keyValue('metadata')),
      field(schema.fileUpload('files').multiple().maxFiles(1)),
    ] as SchemaNodeDefinition[]
    const validator = compileValidator(nodes)
    const output = await validator.validate(
      {
        quantity: 2.5,
        status: 'draft',
        roles: ['editor'],
        tags: ['a'],
        metadata: { color: 'blue' },
        files: ['a'],
      },
      options
    )
    assert.equal((output.metadata as Record<string, string>).color, 'blue')
    await assert.rejects(() =>
      validator.validate(
        {
          quantity: 5.2,
          status: 'invalid',
          roles: ['unknown'],
          tags: ['a', 'b', 'c'],
          metadata: { color: 1 },
          files: ['a', 'b'],
        },
        options
      )
    )
  })

  test('reports nested repeater errors with numeric index paths and strips _key', async ({
    assert,
  }) => {
    const nodes = [
      field(
        schema
          .repeater('items')
          .schema([
            schema.text('sku').required(),
            schema.repeater('variants').schema([schema.text('code').required()]),
          ])
      ),
    ]
    const validator = compileValidator(nodes)
    const error = await captureError(() =>
      validator.validate(
        {
          items: [
            { sku: 'ok', _key: '1' },
            { _key: '2', variants: [{ code: 'yes' }, {}] },
          ],
        },
        options
      )
    )
    assert.isTrue(errorFields(error).includes('items.1.sku'))
    assert.isTrue(errorFields(error).includes('items.1.variants.1.code'))
    const output = await validator.validate({ items: [{ sku: 'ok', _key: 'stable' }] }, options)
    assert.deepEqual(output, { items: [{ sku: 'ok' }] })
  })

  test('dehydrates fields and parses dates into UTC DateTime values', async ({ assert }) => {
    const nodes = [
      field(schema.text('always').required().dehydrated(false)),
      field(
        schema
          .text('conditional')
          .required()
          .dehydratedWhenHidden(false)
          .hidden(({ get }) => get('hide') === true)
      ),
      field(schema.checkbox('hide')),
      field(schema.dateTime('createdAt')),
      field(schema.text('trimmed').dehydrate((value) => String(value).trim())),
    ] as SchemaNodeDefinition[]
    const output = await compileValidator(nodes).validate(
      { hide: true, createdAt: '2026-01-01T12:00:00', trimmed: ' value ' },
      options
    )
    assert.deepEqual(Object.keys(output).sort(), ['createdAt', 'hide', 'trimmed'])
    assert.equal(output.trimmed, 'value')
    const date = output.createdAt as { toISO(): string | null; zoneName: string }
    assert.equal(date.toISO(), '2026-01-01T05:00:00.000Z')
    assert.equal(date.zoneName, 'UTC')
    const dst = await compileValidator([field(schema.dateTime('at'))]).validate(
      { at: '2026-10-25T02:30:00' },
      { timezone: 'Europe/Amsterdam' }
    )
    assert.equal((dst.at as { toISO(): string | null }).toISO(), '2026-10-25T00:30:00.000Z')
    const error = await captureError(() =>
      compileValidator(nodes).validate(
        { hide: false, conditional: 'visible', createdAt: 'not-a-date' },
        options
      )
    )
    assert.deepEqual(errorFields(error), ['createdAt'])
  })

  test('sanitizes rich editor values after validation', async ({ assert }) => {
    const output = await compileValidator([field(schema.richEditor('body'))]).validate(
      { body: '<p>safe</p><script>alert(1)</script>' },
      options
    )
    assert.equal(output.body, '<p>safe</p>')
  })
})
