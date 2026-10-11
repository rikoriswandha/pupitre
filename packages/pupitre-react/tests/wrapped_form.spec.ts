import { test } from '@japa/runner'
import { getFormDescriptor, submitForm } from '../src/bridge/actions.js'
import { setRouter, type RouterLike } from '../src/bridge/inertia.js'
import { createPupitreStore } from '../src/renderer/store.js'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'

const page = {
  spec: {
    root: 'layout',
    elements: {
      layout: { type: 'Stack', props: {}, children: ['widget', 'form'] },
      widget: { type: 'Stack', props: {}, children: [] },
      form: { type: 'Form', props: { method: 'put', url: '/posts/1' }, children: [] },
      orphan: { type: 'Form', props: { method: 'post', url: '/unreachable' } },
    },
  },
} as unknown as PupitrePageProps['page']

test.group('Wrapped resource form', () => {
  test('finds and submits the reachable form beneath page widgets', ({ assert }) => {
    const calls: unknown[][] = []
    const restore = setRouter({
      put: (...args: unknown[]) => calls.push(args),
    } as unknown as RouterLike)
    try {
      assert.equal(getFormDescriptor(page)?.url, '/posts/1')
      const runtime = createPupitreStore({ data: { title: 'Changed' } })
      submitForm(page, runtime.store, () => {})
      assert.equal(calls[0][0], '/posts/1')
      assert.deepEqual(calls[0][1], { title: 'Changed' })
    } finally {
      restore()
    }
  })

  test('does not submit disconnected forms', ({ assert }) => {
    assert.isUndefined(getFormDescriptor({ ...page, spec: { ...page.spec, root: 'widget' } }))
  })
})
