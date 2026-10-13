import { Link, usePage } from '@inertiajs/react'
import type { PupitrePageProps, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { Icon, LedgerSection } from '@rikology/pupitre-ui'
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
    <LedgerSection
      role="region"
      aria-label={descriptor.heading ?? 'Tips'}
      className="h-full"
      heading={descriptor.heading}
      description="A host React component placed in the widget grid."
    >
      <div className="flex items-center justify-between pb-3">
        <span data-testid="component-loader-data">
          {data?.tenant} · {data?.channel}
        </span>
        <button type="button" onClick={() => void reload()} disabled={loading}>
          {t('Refresh')}
        </button>
      </div>
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.href} className="border-t border-border">
            <Link
              href={link.href}
              className="flex items-center gap-2 py-3 text-sm text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Icon name={link.icon} className="size-4 text-muted-foreground" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </LedgerSection>
  )
}
