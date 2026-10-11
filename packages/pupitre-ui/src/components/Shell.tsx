import type { ShellProps } from '@rikology/pupitre-react'
import { useState } from 'react'
import { Icon } from '../icons.js'
import { ActionButton } from './ActionButton.js'
import { GlobalSearch } from './GlobalSearch.js'
import { NotificationTray } from './NotificationTray.js'
import { ShellSidebar } from './ShellSidebar.js'
import { TenantSwitcher } from './TenantSwitcher.js'
import { UserMenu } from './UserMenu.js'
import { usePanelTheme } from './use_panel_theme.js'

/**
 * Panel shell: sidebar (brand, tenant switcher, navigation), topbar
 * (breadcrumbs, global search, notifications, user menu), page header.
 */
export function Shell({
  panel,
  user,
  nav,
  breadcrumbs,
  title,
  headerActions,
  subNavigation = [],
  currentUrl,
  tenant,
  tenants,
  notifications,
  children,
}: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const style = usePanelTheme(panel)
  const topNav = panel.theme?.sidebar === 'top-nav'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = window.localStorage.getItem(`pupitre:${panel.id}:sidebar-collapsed`)
      return stored === null ? panel.theme?.sidebar === 'collapsed' : stored === 'true'
    } catch {
      return panel.theme?.sidebar === 'collapsed'
    }
  })
  const toggleSidebar = () =>
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      try {
        window.localStorage.setItem(`pupitre:${panel.id}:sidebar-collapsed`, String(next))
      } catch {
        // Keep the in-memory toggle available when storage is disabled.
      }
      return next
    })
  const collapsed = panel.theme?.sidebarCollapsibleOnDesktop
    ? sidebarCollapsed
    : panel.theme?.sidebar === 'collapsed'
  const width = panel.theme?.contentWidth ?? '7xl'
  const widthValues: Record<string, string> = {
    'md': '28rem',
    'lg': '32rem',
    'xl': '36rem',
    '2xl': '42rem',
    '3xl': '48rem',
    '4xl': '56rem',
    '5xl': '64rem',
    '6xl': '72rem',
    '7xl': '80rem',
    'full': 'none',
    'screen': '100vw',
  }
  const maxContentWidth = widthValues[width] ?? '80rem'

  return (
    <div
      className={`min-h-screen bg-background text-foreground ${topNav ? 'flex flex-col' : `md:grid ${collapsed ? 'md:grid-cols-[4rem_minmax(0,1fr)]' : 'md:grid-cols-[16rem_minmax(0,1fr)]'}`}`}
      data-density={panel.theme?.density ?? 'comfortable'}
      data-sidebar={panel.theme?.sidebar ?? 'expanded'}
      style={style}
    >
      {!topNav && (
        <aside
          id="pupitre-mobile-navigation"
          className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-background p-4 transition-transform duration-200 ease-out md:static md:translate-x-0 ${collapsed ? 'md:w-16' : 'md:w-auto'}`}
        >
          <TenantSwitcher tenant={tenant} tenants={tenants} />
          {panel.theme?.sidebarCollapsibleOnDesktop && (
            <button
              type="button"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={toggleSidebar}
              className="mb-2 hidden rounded-md p-2 text-muted-foreground hover:bg-muted md:block"
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} className="size-4" />
            </button>
          )}
          <ShellSidebar
            panel={panel}
            nav={nav}
            currentUrl={currentUrl}
            onNavigate={() => setMobileOpen(false)}
            collapsed={collapsed}
          />
        </aside>
      )}
      {topNav && (
        <header className="flex items-center gap-4 border-b border-border px-4 py-3">
          <TenantSwitcher tenant={tenant} tenants={tenants} />
          <ShellSidebar
            panel={panel}
            nav={nav}
            currentUrl={currentUrl}
            onNavigate={() => setMobileOpen(false)}
            topNav
          />
        </header>
      )}
      {!topNav && (
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="pupitre-mobile-navigation"
          className="fixed left-4 top-4 z-40 rounded-md border border-border bg-background p-2 md:hidden"
          onClick={() => setMobileOpen((open) => !open)}
        >
          <Icon name="menu" className="size-4" />
        </button>
      )}
      <main
        className="mx-auto min-w-0 w-full px-4 pb-10 pt-16 md:px-8 md:pt-6"
        style={{ maxWidth: maxContentWidth }}
      >
        <div className="mb-5 flex min-h-10 items-center justify-between gap-4">
          {breadcrumbs.length > 0 ? (
            <nav
              aria-label="Breadcrumb"
              className="flex min-w-0 items-center gap-2 overflow-x-auto text-sm text-muted-foreground"
            >
              {breadcrumbs.map((crumb, index) => (
                <span
                  key={`${crumb.label}-${index}`}
                  className="inline-flex shrink-0 items-center gap-2"
                >
                  {index > 0 && <Icon name="chevron-right" className="size-3" />}
                  {crumb.url ? (
                    <a href={crumb.url} className="hover:text-foreground">
                      {crumb.label}
                    </a>
                  ) : (
                    <span aria-current="page" className="text-foreground">
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 items-center gap-2">
            <GlobalSearch search={panel.search} />
            <NotificationTray notifications={notifications} />
            <UserMenu panel={panel} user={user} />
          </div>
        </div>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="flex flex-wrap gap-2">
            {headerActions.map((action) => (
              <ActionButton key={action.name} action={action} />
            ))}
          </div>
        </header>
        {subNavigation.length > 0 && (
          <nav
            aria-label="Record navigation"
            className="mb-5 flex gap-1 overflow-x-auto border-b border-border"
          >
            {subNavigation.map((item) => (
              <a
                key={item.key}
                href={item.url}
                aria-current={item.active ? 'page' : undefined}
                className="shrink-0 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        {children}
      </main>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  )
}
