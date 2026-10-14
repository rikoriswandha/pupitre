import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ShellProps } from '@rikology/pupitre-react'
import { t } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { NavLink } from '../primitives/nav_link.js'
import { Collapse, Tooltip, cn, popupClasses } from '../primitives/index.js'

const navigationStorageEvent = 'pupitre:nav-storage'

function subscribeNavigationStorage(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', onChange)
  window.addEventListener(navigationStorageEvent, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(navigationStorageEvent, onChange)
  }
}

function navigationStorageSnapshot(panelId: string, nav: ShellProps['nav']) {
  if (typeof window === 'undefined') return '[]'
  try {
    return JSON.stringify(
      nav
        .filter((group) => group.collapsible)
        .map((group) => [
          group.label,
          window.localStorage.getItem(`pupitre:${panelId}:nav:${group.label}`),
        ])
    )
  } catch {
    return '[]'
  }
}

/** Brand mark: logo images, or a primary tile with the brand initial, plus the name. */
export function ShellBrand({
  panel,
  compact = false,
  onNavigate,
}: {
  panel: ShellProps['panel']
  compact?: boolean
  onNavigate?: () => void
}) {
  const brand = panel.brand
  const name = brand?.name ?? (panel.id || 'Pupitre')
  return (
    <NavLink
      data-pupitre-brand=""
      href={panel.path || '/'}
      onClick={onNavigate}
      aria-label={compact ? name : undefined}
      className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 text-[0.9375rem] font-semibold tracking-tight text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
    >
      {brand?.logo || brand?.logoDark ? (
        <>
          {brand.logo && (
            <img
              src={brand.logo}
              alt=""
              className={cn('h-7 w-auto max-w-32 object-contain', brand.logoDark && 'dark:hidden')}
            />
          )}
          {brand.logoDark && (
            <img
              src={brand.logoDark}
              alt=""
              className={cn(
                'h-7 w-auto max-w-32 object-contain',
                brand.logo && 'hidden dark:block'
              )}
            />
          )}
        </>
      ) : (
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-[0.8125rem] font-bold text-primary-foreground shadow-control"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {!compact && <span className="truncate">{name}</span>}
    </NavLink>
  )
}

export type ShellSidebarProps = {
  panel: ShellProps['panel']
  nav: ShellProps['nav']
  currentUrl: string
  onNavigate: () => void
  collapsed?: boolean
  topNav?: boolean
}

type NavItem = ShellProps['nav'][number]['items'][number]

function isActive(item: NavItem, currentUrl: string) {
  return (
    item.active ??
    Boolean(item.url && (currentUrl === item.url || currentUrl.startsWith(`${item.url}/`)))
  )
}

export function ShellSidebar({
  panel,
  nav,
  currentUrl,
  onNavigate,
  collapsed: railCollapsed = false,
  topNav = false,
}: ShellSidebarProps) {
  const [fallbackCollapsed, setFallbackCollapsed] = useState<Record<string, boolean>>({})
  const storageSnapshot = useSyncExternalStore(
    subscribeNavigationStorage,
    () => navigationStorageSnapshot(panel.id, nav),
    () => '[]'
  )
  const storedCollapsed = new Map(JSON.parse(storageSnapshot) as [string, string | null][])
  const collapsedGroups = Object.fromEntries(
    nav
      .filter((group) => group.collapsible)
      .map((group) => {
        const stored = storedCollapsed.get(group.label)
        return [
          group.label,
          fallbackCollapsed[group.label] ??
            (stored === null || stored === undefined
              ? Boolean(group.collapsed)
              : stored === 'true'),
        ]
      })
  )
  function toggleGroup(label: string) {
    const nextValue = !collapsedGroups[label]
    setFallbackCollapsed((current) => ({ ...current, [label]: nextValue }))
    try {
      window.localStorage.setItem(`pupitre:${panel.id}:nav:${label}`, String(nextValue))
      window.dispatchEvent(new Event(navigationStorageEvent))
    } catch {
      // Storage can be disabled by the browser; the in-memory state still works.
    }
  }
  const sideNavRef = useRef<HTMLElement>(null)
  // A long navigation scrolls inside the sidebar; keep the current page's item in view.
  useEffect(() => {
    const navElement = sideNavRef.current
    const active = navElement?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!navElement || !active) return
    const navBox = navElement.getBoundingClientRect()
    const box = active.getBoundingClientRect()
    if (box.top >= navBox.top && box.bottom <= navBox.bottom) return
    navElement.scrollTop += box.top - navBox.top - (navBox.height - box.height) / 2
  }, [currentUrl, topNav])

  if (topNav)
    return (
      <nav
        data-pupitre-nav=""
        aria-label={t('Main navigation')}
        className="flex min-w-0 items-center gap-1"
      >
        {nav.map((group, groupIndex) => {
          const groupActive = group.items.some((item) => isActive(item, currentUrl))
          if (!group.label)
            return group.items.map((item) => (
              <section data-pupitre-nav-group="" key={`${item.label}:${item.url ?? ''}`}>
                <NavLink
                  data-pupitre-nav-item=""
                  href={item.url ?? '#'}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer' : undefined}
                  aria-current={isActive(item, currentUrl) ? 'page' : undefined}
                  onClick={onNavigate}
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                >
                  {item.icon && <Icon name={item.icon} className="size-4" />}
                  {item.label}
                </NavLink>
              </section>
            ))
          return (
            <section
              data-pupitre-nav-group=""
              key={`${group.label}:${groupIndex}`}
              className="relative"
            >
              <details
                className="group"
                onKeyDown={(event) => {
                  if (event.key !== 'Escape' || !event.currentTarget.open) return
                  event.preventDefault()
                  event.currentTarget.open = false
                  event.currentTarget.querySelector('summary')?.focus()
                }}
              >
                <summary
                  className={cn(
                    'flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 text-sm font-medium outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 group-open:bg-muted group-open:text-foreground [&::-webkit-details-marker]:hidden',
                    groupActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {group.icon && <Icon name={group.icon} className="size-4" />}
                  <span>{group.label}</span>
                  <Icon
                    name="chevron-down"
                    className="size-3.5 opacity-60 transition-transform duration-150 group-open:rotate-180"
                  />
                </summary>
                <ul
                  data-pupitre-popup=""
                  className={cn(
                    popupClasses,
                    'absolute left-0 top-full z-40 mt-1.5 min-w-52 [--transform-origin:0_0] starting:scale-[0.98] starting:opacity-0'
                  )}
                >
                  {group.items.map((item) => (
                    <li key={`${item.label}:${item.url ?? ''}`}>
                      <NavLink
                        data-pupitre-nav-item=""
                        href={item.url ?? '#'}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noreferrer' : undefined}
                        aria-current={isActive(item, currentUrl) ? 'page' : undefined}
                        onClick={onNavigate}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none hover:bg-accent focus-visible:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-primary-ink [&_svg]:text-muted-foreground"
                      >
                        {item.icon && <Icon name={item.icon} className="size-4" />}
                        <span className="flex-1">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          )
        })}
      </nav>
    )

  return (
    <nav
      data-pupitre-nav=""
      ref={sideNavRef}
      aria-label={t('Main navigation')}
      className={cn(
        'pupitre-scroll pupitre-scroll-shadows flex-1 space-y-5 overflow-y-auto pb-6 pt-2',
        railCollapsed ? 'px-2' : 'px-3'
      )}
    >
      {nav.map((group, groupIndex) => {
        const groupCollapsed = group.collapsible && collapsedGroups[group.label]
        return (
          <section data-pupitre-nav-group="" key={`${group.label}:${groupIndex}`}>
            {group.label &&
              !railCollapsed &&
              (group.collapsible ? (
                <button
                  type="button"
                  className="mb-1 flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                  aria-expanded={!groupCollapsed}
                  onClick={() => toggleGroup(group.label)}
                >
                  {group.icon && <Icon name={group.icon} className="size-3.5" />}
                  <span className="flex-1">{group.label}</span>
                  <Icon
                    name="chevron-down"
                    className={cn(
                      'size-3.5 transition-transform duration-150',
                      groupCollapsed && '-rotate-90'
                    )}
                  />
                </button>
              ) : (
                <h2 className="mb-1 flex h-7 items-center px-2.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </h2>
              ))}
            {/* The icon rail replaces headings with a divider; collapsible groups keep a toggle. */}
            {group.label && railCollapsed && group.collapsible && (
              <Tooltip label={group.label} side="right">
                <button
                  type="button"
                  aria-label={group.label}
                  aria-expanded={!groupCollapsed}
                  onClick={() => toggleGroup(group.label)}
                  className="mb-1 flex h-6 w-full items-center justify-center gap-1 rounded-md text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {group.icon ? (
                    <Icon name={group.icon} className="size-3.5" />
                  ) : (
                    <span aria-hidden="true" className="h-px w-3 bg-sidebar-border" />
                  )}
                  <Icon
                    name="chevron-down"
                    className={cn(
                      'size-3 transition-transform duration-150',
                      groupCollapsed && '-rotate-90'
                    )}
                  />
                </button>
              </Tooltip>
            )}
            {group.label && railCollapsed && !group.collapsible && groupIndex > 0 && (
              <div aria-hidden="true" className="mx-2 mb-2 h-px bg-sidebar-border" />
            )}
            <Collapse open={!groupCollapsed}>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item, currentUrl)
                  const label = `${item.label}${item.badge !== undefined ? `, ${item.badge}` : ''}`
                  const link = (
                    <NavLink
                      data-pupitre-nav-item=""
                      href={item.url ?? '#'}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noreferrer' : undefined}
                      aria-current={active ? 'page' : undefined}
                      aria-label={label}
                      onClick={onNavigate}
                      className={cn(
                        'group/item flex h-8 items-center gap-2.5 rounded-lg text-sm outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/30',
                        railCollapsed ? 'justify-center px-0' : 'px-2.5',
                        active
                          ? 'bg-sidebar-accent font-medium text-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                      )}
                    >
                      {item.icon ? (
                        <Icon
                          name={item.icon}
                          className={cn(
                            'size-4 shrink-0',
                            active
                              ? 'text-primary-ink'
                              : 'text-muted-foreground group-hover/item:text-foreground'
                          )}
                        />
                      ) : railCollapsed ? (
                        <span
                          aria-hidden="true"
                          className="grid size-5 place-items-center rounded-md bg-sidebar-accent text-[0.6875rem] font-semibold"
                        >
                          {item.label.slice(0, 1).toUpperCase()}
                        </span>
                      ) : null}
                      {!railCollapsed && (
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      )}
                      {!railCollapsed && item.external && (
                        <Icon name="arrow-up-right" className="size-3.5 text-subtle-foreground" />
                      )}
                      {!railCollapsed && item.badge !== undefined && (
                        <span
                          className={cn(
                            'min-w-5 rounded-md px-1.5 text-center text-xs font-medium leading-5 tabular-nums',
                            active
                              ? 'bg-primary-soft text-primary-ink'
                              : 'bg-sidebar-accent text-muted-foreground'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  )
                  return (
                    <li key={`${item.label}:${item.url ?? ''}`}>
                      {railCollapsed ? (
                        <Tooltip label={label} side="right">
                          {link}
                        </Tooltip>
                      ) : (
                        link
                      )}
                      {!railCollapsed && item.children?.length ? (
                        <ul className="ml-[1.125rem] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2.5">
                          {item.children.map((child) => {
                            const childActive = isActive(child, currentUrl)
                            return (
                              <li key={child.label}>
                                <NavLink
                                  data-pupitre-nav-item=""
                                  href={child.url ?? '#'}
                                  aria-current={childActive ? 'page' : undefined}
                                  onClick={onNavigate}
                                  className="flex h-7 items-center rounded-md px-2 text-[0.8125rem] text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                                >
                                  {child.label}
                                </NavLink>
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </Collapse>
          </section>
        )
      })}
    </nav>
  )
}
