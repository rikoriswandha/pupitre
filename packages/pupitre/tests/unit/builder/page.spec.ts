import { test } from '@japa/runner'
import { definePage, pages, schema } from '../../../index.js'

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
test('list modal resources mark form routes as modal actions', ({ assert }) => {
  const list = pages.list()
  const modalList = list.modals()
  assert.isUndefined(list.definition.modals)
  assert.isTrue(modalList.definition.modals)
  assert.isFalse(modalList.modals(false).definition.modals)
})
