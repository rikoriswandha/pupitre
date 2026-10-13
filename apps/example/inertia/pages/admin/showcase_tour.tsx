import { Link, usePage } from '@inertiajs/react'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { PupitreShell } from '@rikology/pupitre-react'
import { Badge, Icon, Kbd, Panel, PanelHeader } from '@rikology/pupitre-ui'
import { registry } from '../../admin/registry.js'

/** `path` is relative to the (tenant-scoped) panel path; `profile` uses the panel's profile URL. */
type Stop = { label: string; path: string; profile?: true; features: string[] }
type Area = { heading: string; icon: string; stops: Stop[] }

const AREAS: Area[] = [
  {
    heading: 'Dashboards & widgets',
    icon: 'chart-column',
    stops: [
      {
        label: 'Store overview',
        path: '/store',
        features: [
          'Stats with sparklines',
          'Line, area, pie, doughnut',
          'Table + timeline',
          'Host widget',
          'Channel filter',
        ],
      },
      {
        label: 'Panel dashboard',
        path: '/',
        features: ['Panel filters', 'Bar chart', 'Table widget'],
      },
    ],
  },
  {
    heading: 'Resources',
    icon: 'layers',
    stops: [
      {
        label: 'Products',
        path: '/products',
        features: [
          'Every input field',
          'Inline-editable cells',
          'Slide-over & custom filters',
          'Bulk actions',
          'Variants relation',
        ],
      },
      {
        label: 'Orders',
        path: '/orders',
        features: [
          'Wizard + repeater',
          'Guarded status actions',
          'History timeline',
          'Read-only relation',
          'Default grouping',
        ],
      },
      {
        label: 'Posts',
        path: '/posts',
        features: [
          'Builder blocks',
          'Rich & Markdown editors',
          'Soft deletes',
          'Import/export',
          'Nested revisions',
        ],
      },
      { label: 'Categories', path: '/catalog/categories', features: ['Drag-to-reorder rows'] },
      { label: 'Tags', path: '/catalog/tags', features: ['Create/edit in modals'] },
      { label: 'Users', path: '/users', features: ['Card grid layout', 'Shield role field'] },
    ],
  },
  {
    heading: 'Custom pages',
    icon: 'sliders-horizontal',
    stops: [
      {
        label: 'Form playground',
        path: '/playground',
        features: [
          'Every layout primitive',
          'Client-lifted reactivity',
          'Validation rules',
          'Dehydration',
        ],
      },
      {
        label: 'Settings',
        path: '/settings',
        features: ['Page form + fill/save', 'Code editor', 'Confirmed action'],
      },
      { label: 'This tour', path: '/tour', features: ['Host Inertia page inside the panel shell'] },
    ],
  },
  {
    heading: 'Platform',
    icon: 'shield-check',
    stops: [
      { label: 'Roles', path: '/roles', features: ['Shield permissions plugin'] },
      { label: 'Activity', path: '/activity', features: ['Audit trail plugin'] },
      { label: 'Profile & security', path: '', profile: true, features: ['MFA', 'Passkeys'] },
    ],
  },
]

/**
 * Host-owned page selected by `definePage('tour').component('admin/showcase_tour')`.
 * It receives normal Pupitre page props and reuses the panel shell.
 */
export default function ShowcaseTour() {
  const { pupitre } = usePage<PupitrePageProps>().props
  // `panel.path` already includes the current tenant segment (e.g. /admin/acme).
  const base = pupitre.panel.path
  return (
    <PupitreShell registry={registry}>
      <div className="space-y-6">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every surface below is declared on the server and rendered by the catalog. Press{' '}
          <Kbd>⌘K</Kbd> for global search, use the bell for notifications, and switch tenants from
          the user menu.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          {AREAS.map((area) => (
            <Panel key={area.heading} role="region" aria-label={area.heading}>
              <PanelHeader heading={area.heading} icon={area.icon} />
              <ul className="divide-y divide-border border-t border-border">
                {area.stops.map((stop) => (
                  <li key={stop.label} className="px-5 py-3 sm:px-6">
                    <Link
                      href={
                        stop.profile
                          ? (pupitre.panel.profileUrl ?? `${base}/profile`)
                          : `${base}${stop.path === '/' ? '' : stop.path}`
                      }
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {stop.label}
                      <Icon name="arrow-right" className="size-3.5 text-muted-foreground" />
                    </Link>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {stop.features.map((feature) => (
                        <Badge key={feature} size="sm">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </div>
    </PupitreShell>
  )
}
