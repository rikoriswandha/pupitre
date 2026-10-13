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
        'mb-6 flex min-w-0 gap-4 overflow-x-auto border-b border-border',
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
            'flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-1 text-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            item.active ? 'border-primary font-medium text-foreground' : 'text-muted-foreground',
            position === 'start' && 'lg:border-b-0 lg:rounded-md lg:px-3 lg:hover:bg-muted',
            position === 'start' && item.active && 'lg:bg-muted'
          )}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
