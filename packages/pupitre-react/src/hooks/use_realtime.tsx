import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { RealtimeClient, RealtimeEvent, TableDescriptor } from '@rikology/pupitre/catalog'
import { getRouter } from '../bridge/inertia.js'

const RealtimeContext = createContext<{
  client?: RealtimeClient
  userChannel?: string
}>({})

export function RealtimeProvider({
  client,
  userChannel,
  children,
}: {
  client?: RealtimeClient
  userChannel?: string
  children: ReactNode
}) {
  return (
    <RealtimeContext.Provider value={{ client, userChannel }}>{children}</RealtimeContext.Provider>
  )
}

/** Returns whether a client and channel are configured; subscribes only after mount. */
export function useRealtimeSubscription(
  channel: string | undefined,
  onEvent: (event: RealtimeEvent) => void
): boolean {
  const { client } = useContext(RealtimeContext)
  const callback = useRef(onEvent)
  useEffect(() => {
    callback.current = onEvent
  }, [onEvent])
  useEffect(() => {
    if (!client || !channel) return
    let active = true
    const unsubscribe = client.subscribe(channel, (event) => {
      if (active) callback.current(event)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [client, channel])
  return Boolean(client && channel)
}

export function useNotificationRealtime(onNotification?: () => void): boolean {
  const { userChannel } = useContext(RealtimeContext)
  return useRealtimeSubscription(userChannel, (event) => {
    if (event.type !== 'pupitre:notification') return
    getRouter().reload({ only: ['pupitre'] })
    onNotification?.()
  })
}

/** Coalesces a burst of table pings into one descriptor-scoped partial reload. */
export function useTableRealtime(descriptor: TableDescriptor): boolean {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { client } = useContext(RealtimeContext)
  const channel = descriptor.realtime?.channel
  const dataProp = descriptor.dataProp ?? 'data'
  useEffect(() => {
    return () => {
      clearTimeout(timer.current)
      timer.current = undefined
    }
  }, [client, channel, dataProp])
  return useRealtimeSubscription(channel, (event) => {
    if (event.type !== 'pupitre:table' || timer.current !== undefined) return
    timer.current = setTimeout(() => {
      timer.current = undefined
      getRouter().reload({ only: [dataProp] })
    }, 0)
  })
}
