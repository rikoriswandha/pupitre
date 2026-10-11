import { test } from '@japa/runner'
import { schema } from '../../../src/builder/schema/schema.js'

test('block builder specialisations are immutable and do not leak', ({ assert }) => {
  const shared = schema.block('content')
  const first = shared.label('First').schema([schema.text('first')])
  const second = shared.label('Second').schema([schema.text('second')])

  assert.notStrictEqual(first, shared)
  assert.notStrictEqual(second, shared)
  assert.deepEqual(shared.toDefinition(), { kind: 'block', name: 'content', schema: [] })
  assert.deepEqual(first.toDefinition(), {
    kind: 'block',
    name: 'content',
    label: 'First',
    schema: [{ kind: 'text', name: 'first' }],
  })
  assert.deepEqual(second.toDefinition(), {
    kind: 'block',
    name: 'content',
    label: 'Second',
    schema: [{ kind: 'text', name: 'second' }],
  })
})
