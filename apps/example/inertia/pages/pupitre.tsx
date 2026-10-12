import { useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import { usePage } from '@inertiajs/react'
import { Pupitre } from '@rikology/pupitre-react'
import { PupitreViewsProvider } from '@rikology/pupitre-ui'
import type { RealtimeClient } from '@rikology/pupitre/catalog'
import { registry, views } from '../admin/registry.js'

export default function PupitrePage(props: ComponentProps<typeof Pupitre>) {
  const { pupitre } = usePage<{ pupitre?: { realtime?: { driver: string } } }>().props
  const enabled = pupitre?.realtime?.driver === 'transmit'
  const [realtime, setRealtime] = useState<RealtimeClient>()
  useEffect(() => {
    if (!enabled) return
    let active = true
    void import('@rikology/pupitre-transmit/client').then(({ transmitRealtimeClient }) => {
      if (active) setRealtime(transmitRealtimeClient())
    })
    return () => {
      active = false
    }
  }, [enabled])
  return (
    <PupitreViewsProvider registry={views}>
      <Pupitre {...props} registry={registry} realtime={enabled ? realtime : undefined} />
    </PupitreViewsProvider>
  )
}
