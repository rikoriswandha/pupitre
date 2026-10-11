import { test } from '@japa/runner'
import { schema } from '../../../src/builder/schema/schema.js'
import { compileForm } from '../../../src/compiler/schema_compiler.js'

test('builder block fields bind beneath the block data object', async ({ assert }) => {
  const compiled = await compileForm(
    [
      schema
        .builder('content')
        .blocks([schema.block('heading').schema((fields) => [fields.text('title')])]),
    ].map((builder) => builder.toDefinition()),
    {
      locale: 'en',
      timezone: 'UTC',
      form: { method: 'post', url: '/posts', submitLabel: 'Save', dirtyGuard: false },
      data: { content: [{ type: 'heading', data: { title: 'Existing' } }] },
    }
  )
  const item = compiled.spec.elements['f.content.heading.item']
  const fieldId = item?.children?.[0]
  const field = fieldId ? compiled.spec.elements[fieldId] : undefined

  assert.deepEqual(field?.props.value, { $bindItem: 'data/title' })
  assert.deepEqual((compiled.state.data as Record<string, unknown>).content, [
    { _key: 'b0', type: 'heading', data: { title: 'Existing' } },
  ])
})
