import { test } from '@japa/runner'
import { definePage, schema } from '../../../index.js'

test('custom page builder is immutable and serializes deterministically', ({ assert }) => {
  const initial = definePage('settings')
  const configured = initial
    .path('/configuration')
    .title('Configuration')
    .form(() => [schema.text('siteName').required()])
  assert.equal(initial.toDefinition().path, '/settings')
  assert.equal(configured.toDefinition().path, '/configuration')
  assert.equal(configured.toJSON(), configured.toJSON())
})
