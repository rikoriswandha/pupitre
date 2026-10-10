import { test } from '@japa/runner'
import { renderToString } from 'react-dom/server'
import { Harness, makeStore } from './_harness.js'

test('M0 K5 SSR: renderer tree renders to string in Node without registering happy-dom', async ({
  assert,
}) => {
  const spec = {
    root: 'field',
    state: { data: { title: 'server' } },
    elements: {
      field: { type: 'Text', props: { name: 'title', value: { $bindState: '/data/title' } } },
    },
  }
  const state = makeStore(spec.state)
  assert.doesNotThrow(() => renderToString(<Harness spec={spec} store={state.store} />))
})
