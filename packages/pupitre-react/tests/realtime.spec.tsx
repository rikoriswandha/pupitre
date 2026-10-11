import { setTimeout as delay } from 'node:timers/promises'
import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { RealtimeClient, RealtimeEvent, TableDescriptor } from '@rikology/pupitre/catalog'
import {
  RealtimeProvider,
  useRealtimeSubscription,
  useTableRealtime,
} from '../src/hooks/use_realtime.js'
import { useNotificationsPolling } from '../src/hooks/use_notifications_polling.js'
import { setRouter } from '../src/bridge/inertia.js'

function subscriptionClient() {
  const subscriptions: Array<{
    channel: string
    callback: (event: RealtimeEvent) => void
    closed: boolean
  }> = []
  const client: RealtimeClient = {
    subscribe(channel, callback) {
      const subscription = { channel, callback, closed: false }
      subscriptions.push(subscription)
      return () => {
        subscription.closed = true
      }
    },
  }
  return { client, subscriptions }
}

test('realtime subscriptions are SSR-safe, keep callbacks current and clean up channel/client changes', async ({
  assert,
}) => {
  const first = subscriptionClient()
  const second = subscriptionClient()
  const events: string[] = []
  function Consumer({ label, channel }: { label: string; channel?: string }) {
    useRealtimeSubscription(channel, () => events.push(label))
    return null
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  const render = (client: RealtimeClient, channel: string | undefined, label: string) => (
    <RealtimeProvider client={client}>
      <Consumer label={label} channel={channel} />
    </RealtimeProvider>
  )
  renderToString(render(first.client, 'one', 'SSR'))
  assert.isEmpty(first.subscriptions)
  try {
    await act(async () => root.render(render(first.client, 'one', 'first')))
    await act(async () => root.render(render(first.client, 'one', 'latest')))
    assert.lengthOf(first.subscriptions, 1)
    first.subscriptions[0].callback({ type: 'pupitre:notification' })
    assert.deepEqual(events, ['latest'])
    await act(async () => root.render(render(first.client, 'two', 'second')))
    assert.isTrue(first.subscriptions[0].closed)
    first.subscriptions[0].callback({ type: 'pupitre:notification' })
    assert.deepEqual(events, ['latest'])
    await act(async () => root.render(render(second.client, 'two', 'third')))
    assert.isTrue(first.subscriptions[1].closed)
    assert.lengthOf(second.subscriptions, 1)
    await act(async () => root.render(render(second.client, undefined, 'disabled')))
    assert.isTrue(second.subscriptions[0].closed)
  } finally {
    await act(async () => root.unmount())
  }
})

test('notifications replace polling only with both a client and user channel and resume fallback', async ({
  assert,
}) => {
  const { client, subscriptions } = subscriptionClient()
  const reloads: unknown[] = []
  const restore = setRouter({ reload: (options: unknown) => reloads.push(options) } as never)
  const originalSet = globalThis.setInterval
  const originalClear = globalThis.clearInterval
  let starts = 0
  let stops = 0
  globalThis.setInterval = (() => ++starts) as unknown as typeof setInterval
  globalThis.clearInterval = (() => {
    stops++
  }) as typeof clearInterval
  let notificationCallbacks = 0
  function Consumer() {
    useNotificationsPolling(1000, () => {
      notificationCallbacks++
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(async () =>
      root.render(
        <RealtimeProvider userChannel="user">
          <Consumer />
        </RealtimeProvider>
      )
    )
    assert.equal(starts, 1)
    await act(async () =>
      root.render(
        <RealtimeProvider client={client} userChannel="user">
          <Consumer />
        </RealtimeProvider>
      )
    )
    assert.equal(stops, 1)
    assert.equal(starts, 1)
    subscriptions[0].callback({ type: 'pupitre:table', resource: 'posts' })
    assert.isEmpty(reloads)
    assert.equal(notificationCallbacks, 0)
    subscriptions[0].callback({ type: 'pupitre:notification' })
    assert.deepEqual(reloads, [{ only: ['pupitre'] }])
    assert.equal(notificationCallbacks, 1)
    assert.lengthOf(subscriptions, 1)
    await act(async () =>
      root.render(
        <RealtimeProvider client={client}>
          <Consumer />
        </RealtimeProvider>
      )
    )
    assert.equal(starts, 2)
    assert.isTrue(subscriptions[0].closed)
  } finally {
    await act(async () => root.unmount())
    globalThis.setInterval = originalSet
    globalThis.clearInterval = originalClear
    restore()
  }
  assert.equal(stops, 2)
})

test('table pings coalesce reloads, target the latest data prop and cancel pending work on cleanup', async ({
  assert,
}) => {
  const { client, subscriptions } = subscriptionClient()
  const reloads: unknown[] = []
  const restore = setRouter({ reload: (options: unknown) => reloads.push(options) } as never)
  function Consumer({ dataProp = 'relation_posts' }: { dataProp?: string }) {
    useTableRealtime({ realtime: { channel: 'posts' }, dataProp } as TableDescriptor)
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(async () =>
      root.render(
        <RealtimeProvider client={client}>
          <Consumer />
        </RealtimeProvider>
      )
    )
    subscriptions[0].callback({ type: 'pupitre:notification' })
    subscriptions[0].callback({ type: 'pupitre:table', resource: 'posts' })
    subscriptions[0].callback({ type: 'pupitre:table', resource: 'posts' })
    await delay(10)
    assert.deepEqual(reloads, [{ only: ['relation_posts'] }])
    await act(async () =>
      root.render(
        <RealtimeProvider client={client}>
          <Consumer dataProp="widget_posts" />
        </RealtimeProvider>
      )
    )
    assert.lengthOf(subscriptions, 1)
    subscriptions[0].callback({ type: 'pupitre:table', resource: 'posts' })
    await delay(10)
    assert.deepEqual(reloads[1], { only: ['widget_posts'] })
    subscriptions[0].callback({ type: 'pupitre:table', resource: 'posts' })
    await act(async () => root.unmount())
    await delay(10)
    assert.lengthOf(reloads, 2)
    assert.isTrue(subscriptions[0].closed)
  } finally {
    restore()
  }
})
