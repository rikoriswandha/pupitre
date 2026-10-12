import { useEffect, type ReactNode } from 'react'
import { usePage as useInertiaPage } from '@inertiajs/react'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import type { PupitreRegistry } from '../registry/defineRegistry.js'
import type { RealtimeClient } from '@rikology/pupitre/catalog'
import { RealtimeProvider } from '../hooks/use_realtime.js'
import { configureI18n } from '../i18n.js'

type Props = {
  registry: PupitreRegistry
  realtime?: RealtimeClient
  children: ReactNode
}

/** Wraps host-owned Inertia pages in the exact panel shell used by Pupitre. */
export function PupitreShell({ registry, realtime, children }: Props) {
  const props = useInertiaPage<PupitrePageProps>().props
  configureI18n(props.pupitre.locale, props.pupitre.messages)
  useEffect(() => {
    document.documentElement.lang = props.pupitre.locale
  }, [props.pupitre.locale])
  const Shell = registry.shell.Shell
  return (
    <RealtimeProvider client={realtime} userChannel={props.pupitre.realtime?.userChannel}>
      <Shell
        panel={props.pupitre.panel}
        user={props.pupitre.user}
        nav={props.pupitre.nav}
        breadcrumbs={props.page.breadcrumbs}
        title={props.page.title}
        headerActions={props.page.actions?.header ?? []}
        currentUrl={
          typeof window === 'undefined' ? '' : window.location.pathname + window.location.search
        }
        tenant={props.pupitre.tenant}
        tenants={props.pupitre.tenants ?? []}
        notifications={props.pupitre.notifications}
        locale={props.pupitre.locale}
        locales={props.pupitre.locales}
      >
        {children}
      </Shell>
    </RealtimeProvider>
  )
}
