import { test } from '@japa/runner'
import { schema } from '../../../src/builder/schema/schema.js'
import type { SchemaNodeDefinition } from '../../../src/definition/schema.js'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'

const field = (builder: { toDefinition(): unknown }) =>
  builder.toDefinition() as SchemaNodeDefinition
const options = { timezone: 'UTC' }
async function validationError(operation: () => Promise<unknown>) {
  try {
    await operation()
  } catch (error) {
    return error
  }
  throw new Error('Expected Vine validation to fail')
}
function fields(error: unknown): string[] {
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

test.group('Builder block validation', () => {
  test('validates the active block schema, rejects unknown types and strips item keys', async ({
    assert,
  }) => {
    const validator = compileValidator([
      field(
        schema
          .builder('content')
          .blocks([
            schema.block('heading').schema([schema.text('title').required()]),
            schema.block('paragraph').schema([schema.textarea('body').required()]),
          ])
      ),
    ])
    const output = await validator.validate(
      { content: [{ _key: 'client-key', type: 'heading', data: { title: 'Welcome' } }] },
      options
    )
    assert.deepEqual(output, { content: [{ type: 'heading', data: { title: 'Welcome' } }] })
    const missing = await validationError(() =>
      validator.validate({ content: [{ _key: 'a', type: 'paragraph', data: {} }] }, options)
    )
    assert.deepEqual(fields(missing), ['content.0.data.body'])
    const unknown = await validationError(() =>
      validator.validate({ content: [{ _key: 'b', type: 'script', data: {} }] }, options)
    )
    assert.deepEqual(fields(unknown), ['content.0.type'])
  })

  test('validates repeaters nested inside blocks and builders nested inside repeaters', async ({
    assert,
  }) => {
    const validator = compileValidator([
      field(
        schema
          .builder('content')
          .blocks([
            schema
              .block('list')
              .schema([schema.repeater('items').schema([schema.text('label').required()])]),
          ])
      ),
      field(
        schema
          .repeater('sections')
          .schema([
            schema
              .builder('content')
              .blocks([schema.block('heading').schema([schema.text('title').required()])]),
          ])
      ),
    ])
    const nestedSchema = compileValidator([
      field(schema.repeater('items').schema([schema.text('label').required()])),
    ])
    const nestedError = await validationError(() => nestedSchema.validate({ items: [{}] }, options))
    assert.deepEqual(fields(nestedError), ['items.0.label'])
    const error = await validationError(() =>
      validator.validate(
        {
          content: [{ _key: 'a', type: 'list', data: { items: [{}] } }],
          sections: [{ _key: 's', content: [{ _key: 'b', type: 'heading', data: {} }] }],
        },
        options
      )
    )
    assert.deepEqual(fields(error), [
      'content.0.data.items.0.label',
      'sections.0.content.0.data.title',
    ])
  })
})
