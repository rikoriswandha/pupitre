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
  currentUrl,
  tenant,
  tenants,
  notifications,
  children,
}: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const style = usePanelTheme(panel)

  return (
    <div
      className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[16rem_minmax(0,1fr)]"
      style={style}
    >
      <button
        type="button"
        className="fixed left-3 top-3 z-40 inline-flex size-10 items-center justify-center rounded-md border border-border bg-background md:hidden"
        aria-label="Open navigation"
        onClick={() => setMobileOpen((open) => !open)}
      >
        <Icon name="menu" className="size-5" />
      </button>
      <aside
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-background p-4 transition-transform duration-200 ease-out md:static md:w-auto md:translate-x-0`}
      >
        <TenantSwitcher tenant={tenant} tenants={tenants} />
        <ShellSidebar
          panel={panel}
          nav={nav}
          currentUrl={currentUrl}
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>
      <main className="min-w-0 px-4 pb-10 pt-16 md:px-8 md:pt-6">
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
