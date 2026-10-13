import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { setFetch } from '../src/bridge/actions.js'
import { useWidget, WidgetRequestError } from '../src/hooks/widget.js'
import type { WidgetDescriptor } from '@rikology/pupitre/catalog'
import type { WidgetControls } from '../src/hooks/widget.js'
import type { Window } from 'happy-dom'

const descriptor: WidgetDescriptor = {
  name: 'calendar',
  kind: 'component',
  dataProp: 'widget_calendar',
  dataUrl: '/admin/acme/_pupitre/widgets/calendar?customPage=calendar',
  span: 1,
  sort: 0,
}

test.group('component widget hook', (group) => {
  group.each.setup(() => {
    const testWindow = window as unknown as Window
    const previousUrl = testWindow.location.href
    testWindow.happyDOM.setURL('http://localhost/admin/acme/calendar?filters[region]=asia')
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
      value: true,
      configurable: true,
    })
    return () => {
      testWindow.happyDOM.setURL(previousUrl)
      Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
    }
  })
  test('reload merges query without losing server context and exposes fresh loader data', async ({
    assert,
  }) => {
    const calls: string[] = []
    const restore = setFetch(async (input) => {
      calls.push(String(input))
      if (String(input).includes('/actions/'))
        return new Response(JSON.stringify({ flash: [] }), { status: 200 })
      return new Response(JSON.stringify({ kind: 'component', data: { count: 2 } }), {
        status: 200,
      })
    })
    const rootElement = document.createElement('div')
    const root = createRoot(rootElement)
    let controls: WidgetControls<{ count: number }> | undefined
    const initial = { count: 1 }
    function Consumer() {
      controls = useWidget(descriptor, initial)
      return <output>{controls.data.count}</output>
    }
    try {
      await act(async () => root.render(<Consumer />))
      assert.equal(rootElement.textContent, '1')
      await act(async () => {
        await controls?.reload({ start: '2026-10-01', end: '2026-11-01' })
      })
      assert.equal(rootElement.textContent, '2')
      const url = new URL(calls[0])
      assert.equal(url.searchParams.get('start'), '2026-10-01')
      assert.equal(url.searchParams.get('end'), '2026-11-01')
      assert.equal(url.searchParams.get('customPage'), 'calendar')
      assert.equal(url.searchParams.get('filters[region]'), 'asia')
      await act(async () => {
        await controls?.runAction('move', { id: 1 })
      })
      const actionUrl = new URL(calls[1])
      assert.equal(actionUrl.searchParams.get('start'), '2026-10-01')
      assert.equal(actionUrl.searchParams.get('end'), '2026-11-01')
    } finally {
      await act(async () => root.unmount())
      restore()
    }
  })

  test('actions use JSON transport, return flash and retain 422 errors for rollback', async ({
    assert,
  }) => {
    let invalid = false
    let request: RequestInit | undefined
    let requestedUrl = ''
    const restore = setFetch(async (input, init) => {
      request = init
      requestedUrl = String(input)
      return new Response(
        JSON.stringify(
          invalid
            ? { errors: { start: ['Invalid date'] } }
            : { flash: [{ type: 'success', title: 'Moved' }] }
        ),
        { status: invalid ? 422 : 200 }
      )
    })
    const root = createRoot(document.createElement('div'))
    let controls: WidgetControls<null> | undefined
    function Consumer() {
      controls = useWidget(descriptor, null)
      return null
    }
    try {
      await act(async () => root.render(<Consumer />))
      await act(async () => {
        const result = await controls!.runAction('move', { id: 1 })
        assert.equal(result.flash[0].title, 'Moved')
      })
      assert.equal(new Headers(request?.headers).get('X-Pupitre-Action'), '1')
      assert.deepEqual(JSON.parse(String(request?.body)), { data: { id: 1 } })
      assert.include(requestedUrl, '/actions/move?customPage=calendar')
      invalid = true
      await act(async () => {
        try {
          await controls!.runAction('move', { start: 'bad' })
          assert.fail('Expected validation rejection')
        } catch (error) {
          assert.instanceOf(error, WidgetRequestError)
          if (error instanceof WidgetRequestError) assert.equal(error.status, 422)
        }
      })
      assert.deepEqual(controls!.errors, { start: ['Invalid date'] })
    } finally {
      await act(async () => root.unmount())
      restore()
    }
  })

  test('stale range responses cannot overwrite the latest widget data', async ({ assert }) => {
    const pending: ((response: Response) => void)[] = []
    const restore = setFetch(() => new Promise<Response>((resolve) => pending.push(resolve)))
    const container = document.createElement('div')
    const root = createRoot(container)
    let controls: WidgetControls<{ count: number }> | undefined
    const initial = { count: 0 }
    function Consumer() {
      controls = useWidget(descriptor, initial)
      return <output>{controls.data.count}</output>
    }
    try {
      await act(async () => root.render(<Consumer />))
      let older: Promise<unknown> | undefined
      let newer: Promise<unknown> | undefined
      await act(async () => {
        older = controls!.reload({ start: 'old' })
        newer = controls!.reload({ start: 'new' })
      })
      await act(async () => {
        pending[1](
          new Response(JSON.stringify({ kind: 'component', data: { count: 2 } }), { status: 200 })
        )
        await newer
      })
      assert.equal(container.textContent, '2')
      await act(async () => {
        pending[0](
          new Response(JSON.stringify({ kind: 'component', data: { count: 1 } }), { status: 200 })
        )
        await older
      })
      assert.equal(container.textContent, '2')
      assert.isFalse(controls!.loading)
    } finally {
      await act(async () => root.unmount())
      restore()
    }
  })
})
