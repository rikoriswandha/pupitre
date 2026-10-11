import { useState, useSyncExternalStore } from 'react'
import type { ShellProps } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { NavLink } from '../primitives/nav_link.js'

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

export type ShellSidebarProps = {
  panel: ShellProps['panel']
  nav: ShellProps['nav']
  currentUrl: string
  onNavigate: () => void
  collapsed?: boolean
  topNav?: boolean
}

export function ShellSidebar({
  panel,
  nav,
  currentUrl,
  onNavigate,
  collapsed: railCollapsed = false,
  topNav = false,
}: ShellSidebarProps) {
  const panelPath = panel.path || '/'
  const panelBrand = panel.brand
  const panelId = panel.id || 'Pupitre'
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
  return (
    <>
      <NavLink
        href={panelPath}
        aria-label={railCollapsed ? (panelBrand?.name ?? panelId) : undefined}
        className={`mb-6 flex min-h-10 items-center gap-3 px-2 font-semibold ${railCollapsed ? 'justify-center' : ''}`}
      >
        {panelBrand?.logo || panelBrand?.logoDark ? (
          <>
            {panelBrand.logo && (
              <img src={panelBrand.logo} alt="" className="size-8 object-contain dark:hidden" />
            )}
            {panelBrand.logoDark && (
              <img
                src={panelBrand.logoDark}
                alt=""
                className="hidden size-8 object-contain dark:block"
              />
            )}
          </>
        ) : (
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Icon name="layout-dashboard" className="size-4" />
          </span>
        )}
        {!railCollapsed && <span>{panelBrand?.name ?? panelId}</span>}
      </NavLink>
      <nav
        aria-label="Main navigation"
        className={`flex-1 overflow-y-auto ${topNav ? 'flex items-center gap-2' : 'space-y-5'}`}
      >
        {nav.map((group, groupIndex) => {
          const groupCollapsed = group.collapsible && collapsedGroups[group.label]
          return (
            <section key={`${group.label}:${groupIndex}`} className={topNav ? 'relative' : ''}>
              {topNav ? (
                <details
                  className="group"
                  onKeyDown={(event) => {
                    if (event.key !== 'Escape' || !event.currentTarget.open) return
                    event.preventDefault()
                    event.currentTarget.open = false
                    event.currentTarget.querySelector('summary')?.focus()
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                    {group.icon && <Icon name={group.icon} className="size-4" />}
                    <span>{group.label || 'Menu'}</span>
                    <Icon name="chevron-down" className="size-3" />
                  </summary>
                  <ul className="absolute left-0 top-full z-40 mt-1 min-w-48 rounded-md border border-border bg-background p-1 shadow-lg">
                    {group.items.map((item) => (
                      <li key={`${item.label}:${item.url ?? ''}`}>
                        <NavLink
                          href={item.url ?? '#'}
                          onClick={onNavigate}
                          className="block rounded px-3 py-2 text-sm hover:bg-muted"
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <>
                  {group.label &&
                    (group.collapsible ? (
                      <button
                        type="button"
                        className={`mb-2 flex w-full items-center gap-2 px-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${railCollapsed ? 'justify-center' : ''}`}
                        aria-expanded={!groupCollapsed}
                        title={railCollapsed ? group.label : undefined}
                        onClick={() => toggleGroup(group.label)}
                      >
                        {group.icon && <Icon name={group.icon} className="size-4" />}
                        {!railCollapsed && <span className="flex-1">{group.label}</span>}
                        {!railCollapsed && (
                          <Icon
                            name={groupCollapsed ? 'chevron-right' : 'chevron-down'}
                            className="size-3"
                          />
                        )}
                      </button>
                    ) : group.label && !railCollapsed ? (
                      <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </h2>
                    ) : null)}
                  {!groupCollapsed && (
                    <ul className="space-y-1">
                      {group.items.map((item) => {
                        const active =
                          item.active ??
                          Boolean(
                            item.url &&
                            (currentUrl === item.url || currentUrl.startsWith(`${item.url}/`))
                          )
                        return (
                          <li key={`${item.label}:${item.url ?? ''}`}>
                            <NavLink
                              href={item.url ?? '#'}
                              target={item.external ? '_blank' : undefined}
                              rel={item.external ? 'noreferrer' : undefined}
                              aria-current={active ? 'page' : undefined}
                              aria-label={`${item.label}${item.badge !== undefined ? `, ${item.badge}` : ''}`}
                              title={
                                railCollapsed
                                  ? `${item.label}${item.badge !== undefined ? `, ${item.badge}` : ''}`
                                  : undefined
                              }
                              onClick={onNavigate}
                              className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors ${railCollapsed ? 'justify-center px-2' : ''} ${active ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted'}`}
                            >
                              {item.icon && <Icon name={item.icon} className="size-4 shrink-0" />}
                              {railCollapsed && !item.icon && (
                                <span
                                  aria-hidden="true"
                                  className="size-4 text-center font-semibold"
                                >
                                  {item.label.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              {!railCollapsed && (
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              )}
                              {!railCollapsed && item.badge !== undefined && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                  {item.badge}
                                </span>
                              )}
                            </NavLink>
                            {item.children?.length ? (
                              <ul className="ml-5 mt-1 space-y-1 border-l border-border pl-3">
                                {item.children.map((child) => (
                                  <li key={child.label}>
                                    <NavLink
                                      href={child.url ?? '#'}
                                      className="block rounded px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                                    >
                                      {child.label}
                                    </NavLink>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </section>
          )
        })}
      </nav>
    </>
  )
}
