import { test } from '@japa/runner'
import { schema } from '../../../src/builder/schema/schema.js'
import type { FieldDefinitionUnion } from '../../../src/definition/schema.js'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'

const field = (builder: { toDefinition(): unknown }) =>
  builder.toDefinition() as FieldDefinitionUnion
const validation = { timezone: 'UTC' }

test.group('schema parity validation', () => {
  test('validates URL and configurable phone fields', async ({ assert }) => {
    const validator = compileValidator([
      field(schema.text('website').url()),
      field(
        schema
          .text('phone')
          .tel()
          .telRegex(/^\d{10}$/)
      ),
    ])
    assert.deepEqual(
      await validator.validate(
        { website: 'https://example.test/path', phone: '0212345678' },
        validation
      ),
      { website: 'https://example.test/path', phone: '0212345678' }
    )
    await assert.rejects(() =>
      validator.validate({ website: 'not a URL', phone: '0212345678' }, validation)
    )
    await assert.rejects(() =>
      validator.validate({ website: 'https://example.test', phone: '123' }, validation)
    )
  })

  test('enforces slider scalar, range, step, and bounds', async ({ assert }) => {
    const scalar = compileValidator([
      field(schema.slider('priority').min(0).max(100).step(5).required()),
    ])
    assert.deepEqual(await scalar.validate({ priority: 25 }, validation), { priority: 25 })
    await assert.rejects(() => scalar.validate({ priority: 26 }, validation))
    await assert.rejects(() => scalar.validate({ priority: 105 }, validation))

    const range = compileValidator([
      field(schema.slider('price').min(10).max(50).step(5).range().required()),
    ])
    assert.deepEqual(await range.validate({ price: [15, 40] }, validation), { price: [15, 40] })
    await assert.rejects(() => range.validate({ price: [5, 40] }, validation))
    await assert.rejects(() => range.validate({ price: [40, 15] }, validation))
    await assert.rejects(() => range.validate({ price: [15, 20, 25] }, validation))
  })
})
