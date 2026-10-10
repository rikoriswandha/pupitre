import { test } from '@japa/runner'
import { act } from 'react'
import { actionLog, clearActionLog, clearMounts, mountHarness, mountCount } from './_harness.js'

test.group('M0 K3 watch actions', () => {
  test('watch stays quiet on mount, runs sequential actions on change, writes async result without remount', async ({
    assert,
  }) => {
    clearActionLog()
    clearMounts()
    const spec = {
      root: 'form',
      state: { data: { status: 'draft', slug: '' }, log: [] },
      elements: {
        form: { type: 'Form', props: {}, children: ['status'] },
        status: {
          type: 'Text',
          props: { name: 'status', value: { $bindState: '/data/status' } },
          watch: {
            '/data/status': [
              { action: 'appendLog', params: { value: 'first' } },
              { action: 'appendLog', params: { value: 'second' } },
              { action: 'asyncWrite', params: { path: '/data/slug', value: 'published' } },
            ],
          },
        },
      },
    }
    const view = mountHarness(spec)
    try {
      assert.deepEqual(actionLog, [])
      act(() => view.store.store.set('/data/status', 'published'))
      const tick = Promise.withResolvers<void>()
      setTimeout(tick.resolve, 10)
      await act(async () => tick.promise)
      assert.deepEqual(actionLog, ['first', 'second'])
      assert.equal(view.store.store.get('/data/slug'), 'published')
      assert.equal(mountCount('Form'), 1)
    } finally {
      view.unmount()
    }
  })
})
