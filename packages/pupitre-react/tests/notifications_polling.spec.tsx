import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { setRouter } from '../src/bridge/inertia.js'
import { useNotificationsPolling } from '../src/hooks/use_notifications_polling.js'

function PollingHarness({ interval }: { interval: number }) {
  useNotificationsPolling(interval)
  return null
}

test('notification polling reloads only Pupitre props and pauses while the document is hidden', async ({
  assert,
}) => {
  const dom = new Window()
  const oldDocument = globalThis.document
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document })
  const rootElement = dom.document.createElement('div')
  dom.document.body.append(rootElement)
  let tick: (() => void) | undefined
  let cleared = false
  const originalSetInterval = globalThis.setInterval
  const originalClearInterval = globalThis.clearInterval
  globalThis.setInterval = ((callback: TimerHandler) => {
    tick = callback as () => void
    return 17
  }) as unknown as typeof setInterval
  globalThis.clearInterval = ((handle: unknown) => {
    cleared = handle === 17
  }) as typeof clearInterval
  const reloads: unknown[] = []
  const restoreRouter = setRouter({
    reload(options: unknown) {
      reloads.push(options)
    },
    visit() {},
    put() {},
    post() {},
    on() {
      return () => {}
    },
  } as never)
  const root = createRoot(rootElement as unknown as Element)
  try {
    await act(async () => root.render(<PollingHarness interval={5000} />))
    Object.defineProperty(dom.document, 'visibilityState', { configurable: true, value: 'hidden' })
    await act(async () => dom.document.dispatchEvent(new dom.window.Event('visibilitychange')))
    assert.isTrue(cleared)
    assert.isEmpty(reloads)
    Object.defineProperty(dom.document, 'visibilityState', { configurable: true, value: 'visible' })
    await act(async () => dom.document.dispatchEvent(new dom.window.Event('visibilitychange')))
    tick?.()
    assert.deepEqual(reloads, [{ only: ['pupitre'] }])
  } finally {
    await act(async () => root.unmount())
    restoreRouter()
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
    Object.defineProperty(globalThis, 'document', { configurable: true, value: oldDocument })
    dom.happyDOM.abort()
  }
  assert.isTrue(cleared)
})
