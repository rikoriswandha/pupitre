import { useEffect } from 'react'
import { getRouter } from '../bridge/inertia.js'
import { useNotificationRealtime } from './use_realtime.js'

/** Refreshes shared panel props on the configured interval while the tab is visible. */
export function useNotificationsPolling(
  interval: number | undefined,
  onNotification?: () => void
): void {
  const realtime = useNotificationRealtime(onNotification)
  useEffect(() => {
    if (realtime || !interval || interval <= 0 || typeof document === 'undefined') return
    let timer: NodeJS.Timeout | number | undefined
    const poll = () => getRouter().reload({ only: ['pupitre'] })
    const start = () => {
      if (timer !== undefined || document.visibilityState === 'hidden') return
      timer = globalThis.setInterval(poll, interval)
    }
    const stop = () => {
      if (timer === undefined) return
      globalThis.clearInterval(timer)
      timer = undefined
    }
    const updateVisibility = () => {
      if (document.visibilityState === 'hidden') stop()
      else start()
    }
    start()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
      stop()
    }
  }, [interval, realtime])
}
