import { test } from '@japa/runner'
import vine from '@vinejs/vine'
import { schema } from '../../../src/builder/schema/schema.js'
import type { FieldDefinitionUnion, SchemaNodeDefinition } from '../../../src/definition/schema.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'

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

function errorMessages(error: unknown): string[] {
  if (
    !error ||
    typeof error !== 'object' ||
    !('messages' in error) ||
    !Array.isArray(error.messages)
  ) {
    return []
  }
  return error.messages.flatMap((message) =>
    message &&
    typeof message === 'object' &&
    'message' in message &&
    typeof message.message === 'string'
      ? [message.message]
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

  test('preserves null for optional fields and omits untouched undefined fields', async ({
    assert,
  }) => {
    const validator = compileValidator([
      field(schema.text('optional')),
      field(schema.text('untouched')),
    ])
    assert.deepEqual(await validator.validate({ optional: null }, options), { optional: null })
  })

  test('accepts only persisted or same-resource same-field uploaded file keys', async ({
    assert,
  }) => {
    const nodes = [field(schema.fileUpload('cover'))] as SchemaNodeDefinition[]
    const sessionUploads = [
      { key: 'posts/cover/new.png', resource: 'posts', field: 'cover', ability: 'create' },
      { key: 'posts/body/wrong.png', resource: 'posts', field: 'body', ability: 'create' },
      { key: 'posts/cover/other.png', resource: 'articles', field: 'cover', ability: 'create' },
    ]
    const ctx = {
      session: { get: (key: string) => (key === 'pupitre.uploads' ? sessionUploads : undefined) },
      pupitre: { panel: { resources: [{ slug: 'posts', definition: { form: nodes } }] } },
    } as unknown as HttpContext
    const record = {
      serialize: () => ({ cover: 'posts/cover/old.png' }),
    } as unknown as LucidRow
    const validator = compileValidator(nodes)
    assert.deepEqual(
      await validator.validate({ cover: 'posts/cover/new.png' }, { ...options, ctx, record }),
      { cover: 'posts/cover/new.png' }
    )
    assert.deepEqual(
      await validator.validate({ cover: 'posts/cover/old.png' }, { ...options, ctx, record }),
      { cover: 'posts/cover/old.png' }
    )
    const error = await captureError(() =>
      validator.validate({ cover: 'posts/body/wrong.png' }, { ...options, ctx, record })
    )
    assert.deepEqual(errorFields(error), ['cover'])
    assert.include(errorMessages(error).join(' '), 'not uploaded for this field')
  })
  test('accepts persisted upload keys inside repeater rows after session ownership is pruned', async ({
    assert,
  }) => {
    const nodes = [
      schema
        .repeater('items')
        .schema([schema.fileUpload('attachment')])
        .toDefinition(),
    ] as SchemaNodeDefinition[]
    const ctx = {
      session: { get: () => [] },
      pupitre: { panel: { resources: [{ slug: 'posts', definition: { form: nodes } }] } },
    } as unknown as HttpContext
    const record = {
      serialize: () => ({ items: [{ attachment: 'posts/items/attachment/persisted.png' }] }),
    } as unknown as LucidRow
    assert.deepEqual(
      await compileValidator(nodes).validate(
        { items: [{ attachment: 'posts/items/attachment/persisted.png' }] },
        { ...options, ctx, record }
      ),
      { items: [{ attachment: 'posts/items/attachment/persisted.png' }] }
    )
  })

  test('does not dehydrate disabled fields unless explicitly enabled', async ({ assert }) => {
    const output = await compileValidator([
      field(schema.text('fixed').disabled(true).required()),
      field(
        schema
          .text('conditional')
          .disabled(({ get }) => get('locked') === true)
          .required()
      ),
      field(schema.text('persisted').disabled(true).required().dehydrated(true)),
      field(schema.checkbox('locked')),
    ]).validate(
      { fixed: 'crafted', conditional: 'crafted', persisted: 'kept', locked: true },
      options
    )
    assert.deepEqual(output, { persisted: 'kept', locked: true })
  })

  test('preserves wall-clock time strings and rejects invalid clock values', async ({ assert }) => {
    const validator = compileValidator([field(schema.time('at'))])
    assert.deepEqual(await validator.validate({ at: '14:30' }, options), { at: '14:30' })
    assert.deepEqual(await validator.validate({ at: '14:30:45' }, options), { at: '14:30:45' })
    for (const at of ['24:00', '12:60', '09:10:60', '9:10', '2026-01-01T14:30:00']) {
      const error = await captureError(() => validator.validate({ at }, options))
      assert.deepEqual(errorFields(error), ['at'])
    }
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
    const ctx = {
      session: {
        get: () => [{ key: 'a', resource: 'posts', field: 'files', ability: 'create' }],
      },
      pupitre: { panel: { resources: [{ slug: 'posts', definition: { form: nodes } }] } },
    } as unknown as HttpContext
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
      { ...options, ctx }
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
        { ...options, ctx }
      )
    )
  })
  test('compares option values by string and returns each option canonical value', async ({
    assert,
  }) => {
    const validator = compileValidator([
      field(schema.select('categoryId').options({ '1': 'One', '2': 'Two' })),
      field(schema.radio('radio').options({ '1': 'One' })),
      field(schema.toggleButtons('buttons').options({ '1': 'One' })),
      field(schema.checkboxList('checked').options({ '1': 'One' })),
      field(schema.toggleButtons('multiple').options({ '1': 'One' }).multiple()),
    ])

    assert.deepEqual(
      await validator.validate(
        { categoryId: 1, radio: 1, buttons: 1, checked: [1], multiple: [1] },
        options
      ),
      {
        categoryId: '1',
        radio: '1',
        buttons: '1',
        checked: ['1'],
        multiple: ['1'],
      }
    )

    const error = await captureError(() => validator.validate({ categoryId: 3 }, options))
    assert.deepEqual(errorFields(error), ['categoryId'])
  })
  test('validates closure-based select values and rejects non-scalar submissions', async ({
    assert,
  }) => {
    const nodes = [
      field(
        schema
          .select('single')
          .options(({ search, values }) =>
            [{ value: 'allowed-id', label: 'Allowed option' }].filter(
              (option) =>
                values?.some((value) => String(value) === String(option.value)) ||
                option.label.toLowerCase().includes(search.toLowerCase())
            )
          )
      ),
      field(
        schema
          .multiSelect('multiple')
          .options(({ search, values }) =>
            [{ value: 'allowed-id', label: 'Allowed option' }].filter(
              (option) =>
                values?.some((value) => String(value) === String(option.value)) ||
                option.label.toLowerCase().includes(search.toLowerCase())
            )
          )
      ),
    ]
    const validator = compileValidator(nodes)
    const ctx = {} as HttpContext
    assert.deepEqual(
      await validator.validate(
        { single: 'allowed-id', multiple: ['allowed-id'] },
        { ...options, ctx }
      ),
      { single: 'allowed-id', multiple: ['allowed-id'] }
    )
    for (const single of ['not-allowed', {}, []]) {
      const error = await captureError(() =>
        validator.validate({ single, multiple: [] }, { ...options, ctx })
      )
      assert.deepEqual(errorFields(error), ['single'])
    }
    const arrayError = await captureError(() =>
      validator.validate({ single: 'allowed-id', multiple: ['not-allowed'] }, { ...options, ctx })
    )
    assert.deepEqual(errorFields(arrayError), ['multiple.0'])
  })

  test('uses numeric values from array options as canonical values', async ({ assert }) => {
    const validator = compileValidator([
      field(schema.select('categoryId').options([{ value: 1, label: 'One' }])),
    ])
    assert.deepEqual(await validator.validate({ categoryId: '1' }, options), { categoryId: 1 })
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
  test('preserves null date, dateTime and time values', async ({ assert }) => {
    const validator = compileValidator([
      field(schema.date('date')),
      field(schema.dateTime('dateTime')),
      field(schema.time('time')),
    ])
    assert.deepEqual(
      await validator.validate({ date: null, dateTime: null, time: null }, options),
      { date: null, dateTime: null, time: null }
    )
  })

  test('sanitizes rich editor values after validation', async ({ assert }) => {
    const output = await compileValidator([field(schema.richEditor('body'))]).validate(
      { body: '<p>safe</p><script>alert(1)</script>' },
      options
    )
    assert.equal(output.body, '<p>safe</p>')
  })
})
