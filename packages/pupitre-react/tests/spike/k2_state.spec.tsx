import { test } from '@japa/runner'
import { act } from 'react'
import { mountHarness } from './_harness.js'

const spec = {
  root: 'field',
  state: { data: { title: 'server' } },
  elements: {
    field: { type: 'Text', props: { name: 'title', value: { $bindState: '/data/title' } } },
  },
}

test.group('M0 K2 Inertia state semantics', () => {
  test('same page key preserves user data; a different key initializes the new record', async ({
    assert,
  }) => {
    const view = mountHarness(spec, undefined, 'record-1')
    try {
      act(() => view.store.store.set('/data/title', 'draft x'))
      view.renderPage({ ...spec, state: { data: { title: 'new props' } } }, 'record-1')
      assert.equal(view.store.store.get('/data/title'), 'draft x')
      view.renderPage({ ...spec, state: { data: { title: 'record 2' } } }, 'record-2')
      assert.equal(view.store.store.get('/data/title'), 'record 2')
    } finally {
      view.unmount()
    }
  })

  test('422 field errors map to /errors without mutating /data', async ({ assert }) => {
    const view = mountHarness(spec)
    try {
      const before = view.store.store.get('/data/title')
      const responseErrors = { 'items.0.sku': 'Required' }
      for (const [path, message] of Object.entries(responseErrors)) {
        act(() => view.store.store.set(`/errors/${path.replaceAll('.', '/')}`, message))
      }
      assert.equal(view.store.store.get('/errors/items/0/sku'), 'Required')
      assert.equal(view.store.store.get('/data/title'), before)
    } finally {
      view.unmount()
    }
  })
})
