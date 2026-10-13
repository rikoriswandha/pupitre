import type { SubNavigationItem } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { NavLink } from '../primitives/nav_link.js'
import { cn } from '../primitives/index.js'

export function ClusterNavigation({
  items,
  position = 'start',
}: {
  items: SubNavigationItem[]
  position?: 'start' | 'top'
}) {
  if (!items.length) return null
  return (
    <nav
      aria-label={t('Cluster navigation')}
      className={cn(
        'mb-6 flex min-w-0 gap-1 overflow-x-auto border-b border-border pb-2',
        position === 'start' &&
          'lg:mb-0 lg:w-48 lg:shrink-0 lg:flex-col lg:self-start lg:border-b-0 lg:border-r lg:pr-4'
      )}
    >
      {items.map((item) => (
        <NavLink
          key={item.key}
          href={item.url}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
            item.active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
          )}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
