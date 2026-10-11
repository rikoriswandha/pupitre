import { Transmit } from '@adonisjs/transmit-client'
import type { Subscription } from '@adonisjs/transmit-client'
import { realtimeEvent } from '@rikology/pupitre/catalog'
import type { RealtimeClient, RealtimeEvent } from '@rikology/pupitre/catalog'

export type TransmitRealtimeClientOptions = Partial<ConstructorParameters<typeof Transmit>[0]>

/** Creates no browser resources until the first subscription (safe during SSR). */
export function transmitRealtimeClient(
  options: TransmitRealtimeClientOptions = {}
): RealtimeClient {
  let transmit: Transmit | undefined
  let connected = false
  type Entry = {
    subscription: Subscription
    handlers: Set<(event: RealtimeEvent) => void>
    ready: Promise<void>
    removeListener: () => void
    removeConnect?: () => void
  }
  const entries = new Map<string, Entry>()
  const headers = (request: Request) => {
    const cookie =
      typeof document === 'undefined'
        ? undefined
        : document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='))
    if (cookie) request.headers.set('X-XSRF-TOKEN', cookie.slice('XSRF-TOKEN='.length))
  }
  const createWhenConnected = (entry: Entry) => {
    if (connected) {
      entry.ready = entry.subscription.create()
      return
    }
    const client = transmit!
    const onConnect = () => {
      entry.removeConnect?.()
      entry.removeConnect = undefined
      if (entry.handlers.size) entry.ready = entry.subscription.create()
    }
    client.on('connected', onConnect)
    entry.removeConnect = () => client.off('connected', onConnect)
  }
  return {
    subscribe(channel, onEvent) {
      if (!transmit) {
        transmit = new Transmit({
          ...options,
          eventTargetFactory: () => options.eventTargetFactory?.() ?? new EventTarget(),
          baseUrl: options.baseUrl ?? window.location.origin,
          beforeSubscribe(request) {
            headers(request)
            options.beforeSubscribe?.(request)
          },
          beforeUnsubscribe(request) {
            headers(request)
            options.beforeUnsubscribe?.(request)
          },
        })
        transmit.on('connected', () => {
          connected = true
        })
        transmit.on('disconnected', () => {
          connected = false
        })
      }
      let entry = entries.get(channel)
      if (!entry) {
        const subscription = transmit.subscription(channel)
        const handlers = new Set<(event: RealtimeEvent) => void>()
        const removeListener = subscription.onMessage<unknown>((payload) => {
          const result = realtimeEvent.safeParse(payload)
          if (result.success) for (const handler of handlers) handler(result.data)
        })
        entry = { subscription, handlers, ready: Promise.resolve(), removeListener }
        entries.set(channel, entry)
      }
      const owned = entry
      owned.handlers.add(onEvent)
      if (owned.handlers.size === 1 && !owned.subscription.isCreated && !owned.removeConnect) {
        createWhenConnected(owned)
      }
      let active = true
      return () => {
        if (!active) return
        active = false
        owned.handlers.delete(onEvent)
        if (owned.handlers.size) return
        owned.removeConnect?.()
        owned.removeConnect = undefined
        // Wait for pending creation: Transmit ignores delete() before creation.
        owned.ready = owned.ready.then(async () => {
          if (owned.handlers.size || entries.get(channel) !== owned) return
          await owned.subscription.delete()
          owned.removeListener()
          if (owned.handlers.size) {
            // A listener arrived while the unsubscribe request was in flight.
            owned.subscription = transmit!.subscription(channel)
            owned.removeListener = owned.subscription.onMessage<unknown>((payload) => {
              const result = realtimeEvent.safeParse(payload)
              if (result.success) for (const handler of owned.handlers) handler(result.data)
            })
            createWhenConnected(owned)
            return
          }
          entries.delete(channel)
          if (!entries.size) {
            transmit?.close()
            transmit = undefined
            connected = false
          }
        })
      }
    },
  }
}
