import { Link, usePage } from '@inertiajs/react'
import type { PupitrePageProps, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { Icon, Panel, PanelHeader } from '@rikology/pupitre-ui'
import { t, useWidget } from '@rikology/pupitre-react'

/** Host widget rendered by `defineWidget(...).component('StoreTipsWidget')`. */
export function StoreTipsWidget({
  descriptor,
  data: initialData,
}: {
  descriptor: WidgetDescriptor
  data: { tenant?: string; channel?: string }
}) {
  const { data, reload, loading } = useWidget(descriptor, initialData)
  const { pupitre } = usePage<PupitrePageProps>().props
  // `panel.path` already includes the current tenant segment (e.g. /admin/acme).
  const base = pupitre.panel.path
  const links = [
    { href: `${base}/products?tab=lowStock`, icon: 'trending-down', label: 'Low-stock products' },
    { href: `${base}/orders?tab=open`, icon: 'inbox', label: 'Orders to fulfil' },
    { href: `${base}/playground`, icon: 'sliders-horizontal', label: 'Form playground' },
    { href: `${base}/tour`, icon: 'star', label: 'Showcase tour' },
  ]
  return (
    <Panel role="region" aria-label={descriptor.heading ?? 'Tips'} className="h-full">
      <PanelHeader
        heading={descriptor.heading}
        description="A host React component placed in the widget grid."
        icon="info"
      />
      <div className="flex items-center justify-between px-4 pb-3">
        <span data-testid="component-loader-data">
          {data?.tenant} · {data?.channel}
        </span>
        <button type="button" onClick={() => void reload()} disabled={loading}>
          {t('Refresh')}
        </button>
      </div>
      <ul className="grid gap-1 px-3 pb-4 sm:grid-cols-2 sm:px-4">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Icon name={link.icon} className="size-4 text-muted-foreground" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
