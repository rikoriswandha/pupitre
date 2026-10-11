import { test } from '@japa/runner'
import { assertHidden, assertSpecHas, assertVisible } from '../../../testing/index.js'

const spec = {
  root: 'form',
  elements: {
    form: { type: 'Form', props: {} },
    publishedAt: {
      type: 'DateTimeInput',
      props: { label: 'Published at' },
      visible: { $state: '/data/status', eq: 'published' },
    },
  },
} as const

test.group('Pupitre testing helpers', () => {
  test('asserts component presence and props', ({ assert }) => {
    assertSpecHas(spec as never, {
      type: 'DateTimeInput',
      name: 'publishedAt',
      props: { label: 'Published at' },
    })
    assert.throws(
      () => assertSpecHas(spec as never, { type: 'TextInput' }),
      /Expected spec to contain TextInput/
    )
  })

  test('evaluates visibility expressions against JSON state paths', ({ assert }) => {
    assertVisible(spec as never, { data: { status: 'published' } }, 'publishedAt')
    assertHidden(spec as never, { data: { status: 'draft' } }, 'publishedAt')
    assert.throws(
      () => assertVisible(spec as never, { data: { status: 'draft' } }, 'publishedAt'),
      /Expected "publishedAt" to be visible/
    )
  })
})
