import { test } from '@japa/runner'
import { setTimeout as delay } from 'node:timers/promises'
import { transmitRealtimeClient } from '../client/index.js'
import type { RealtimeEvent } from '@rikology/pupitre/catalog'

function fixture() {
  const sources: EventTarget[] = []
  const closed: boolean[] = []
  const requests: Request[] = []
  const original = globalThis.fetch
  globalThis.fetch = async (input) => {
    requests.push(input as Request)
    return new Response(null, { status: 204 })
  }
  const client = transmitRealtimeClient({
    baseUrl: 'http://localhost:3403',
    uidGenerator: () => 'client-test',
    eventTargetFactory: () => null,
    eventSourceFactory: () => {
      const source = new EventTarget()
      const index = sources.push(source) - 1
      Object.assign(source, {
        close() {
          closed[index] = true
        },
      })
      queueMicrotask(() => source.dispatchEvent(new Event('open')))
      return source as EventSource
    },
  })
  return {
    client,
    sources,
    closed,
    requests,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

test('client factory is SSR safe and shares subscriptions, validates pings and cleans up', async ({
  assert,
  cleanup,
}) => {
  const { client, sources, closed, requests, restore } = fixture()
  cleanup(restore)
  assert.lengthOf(sources, 0)
  const first: RealtimeEvent[] = []
  const second: RealtimeEvent[] = []
  const offA = client.subscribe('pupitre/admin/resources/posts', (event) => first.push(event))
  const offB = client.subscribe('pupitre/admin/resources/posts', (event) => second.push(event))
  await delay(130)
  assert.lengthOf(
    requests.filter((request) => request.url.endsWith('/subscribe')),
    1
  )
  const message = new Event('message')
  Object.assign(message, {
    data: JSON.stringify({
      channel: 'pupitre/admin/resources/posts',
      payload: { type: 'pupitre:table', resource: 'posts' },
    }),
  })
  sources[0].dispatchEvent(message)
  assert.deepEqual(first, [{ type: 'pupitre:table', resource: 'posts' }])
  assert.deepEqual(second, first)
  offA()
  await delay(130)
  assert.lengthOf(
    requests.filter((request) => request.url.endsWith('/unsubscribe')),
    0
  )
  offB()
  offB()
  await delay(130)
  assert.lengthOf(
    requests.filter((request) => request.url.endsWith('/unsubscribe')),
    1
  )
  assert.isTrue(closed[0])
})

test('unmount before connection cancels pending creation and closes the stream', async ({
  assert,
  cleanup,
}) => {
  const { client, requests, closed, restore } = fixture()
  cleanup(restore)
  const off = client.subscribe('pupitre/admin/users/1', () => {})
  off()
  await delay(130)
  assert.lengthOf(requests, 0)
  assert.isTrue(closed[0])
})

test('subscribe and unsubscribe carry the encrypted Shield XSRF cookie header', async ({
  assert,
  cleanup,
}) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie: 'other=value; XSRF-TOKEN=s%3Aencrypted-token' },
  })
  cleanup(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  const { client, requests, restore } = fixture()
  cleanup(restore)
  const off = client.subscribe('pupitre/admin/users/1', () => {})
  await delay(130)
  off()
  await delay(130)
  assert.lengthOf(requests, 2)
  assert.equal(requests[0].headers.get('X-XSRF-TOKEN'), 's%3Aencrypted-token')
  assert.equal(requests[1].headers.get('X-XSRF-TOKEN'), 's%3Aencrypted-token')
})
