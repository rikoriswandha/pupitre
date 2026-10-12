import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { setFetch } from '../src/bridge/actions.js'
import { useOptions } from '../src/hooks/use_options.js'

for (const ordering of ['during debounce', 'after latest response']) {
  test(`useOptions discards superseded responses ${ordering}`, async ({ assert }) => {
    const dom = new Window()
    Object.assign(globalThis, {
      window: dom,
      document: dom.document,
      IS_REACT_ACT_ENVIRONMENT: true,
    })
    const container = dom.document.createElement('div')
    dom.document.body.append(container)
    const root = createRoot(container as unknown as Element)
    const requests: {
      response: ReturnType<typeof Promise.withResolvers<Response>>
      signal: AbortSignal
    }[] = []
    const restoreFetch = setFetch((async (_input, init) => {
      const response = Promise.withResolvers<Response>()
      requests.push({ response, signal: init!.signal! })
      // Deliberately ignore abort: the hook must also guard result commits.
      return response.promise
    }) as typeof fetch)
    let current: ReturnType<typeof useOptions>
    function Harness() {
      current = useOptions({ url: '/options', value: [], debounce: 60 })
      return null
    }
    const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 80))
    const result = (label: string, hasMore: boolean) =>
      new Response(JSON.stringify({ options: [{ value: label, label }], hasMore }))
    try {
      await act(async () => root.render(<Harness />))
      await act(pause)
      assert.lengthOf(requests, 1)
      await act(async () => current!.setSearch('latest'))
      assert.isTrue(requests[0].signal.aborted)
      if (ordering === 'during debounce') {
        await act(async () => requests[0].response.resolve(result('stale', true)))
        assert.deepEqual(current!.options, [])
        assert.isFalse(current!.hasMore)
      }
      await act(pause)
      assert.lengthOf(requests, 2)
      await act(async () => requests[1].response.resolve(result('latest', false)))
      if (ordering === 'after latest response') {
        await act(async () => requests[0].response.resolve(result('stale', true)))
      }
      assert.deepEqual(
        current!.options.map((option) => option.label),
        ['latest']
      )
      assert.isFalse(current!.hasMore)
      assert.isFalse(current!.loading)
      assert.isNull(current!.error)
    } finally {
      await act(async () => root.unmount())
      restoreFetch()
      dom.happyDOM.abort()
    }
  })
}
