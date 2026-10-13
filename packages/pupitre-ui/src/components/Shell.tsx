import { ImpersonationBanner } from './ImpersonationBanner.js'
import type { ShellProps } from '@rikology/pupitre-react'
import { Dialog } from '@base-ui/react/dialog'
import { t } from '@rikology/pupitre-react'
import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Icon } from '../icons.js'
import { NavLink } from '../primitives/nav_link.js'
import {
  Button,
  Tooltip,
  backdropClasses,
  cn,
  underlineTabClasses,
  underlineTabListClasses,
} from '../primitives/index.js'
import { ActionList } from './ActionList.js'
import { GlobalSearch } from './GlobalSearch.js'
import { NotificationTray } from './NotificationTray.js'
import { ShellBrand, ShellSidebar } from './ShellSidebar.js'
import { TenantSwitcher } from './TenantSwitcher.js'
import { UserMenu } from './UserMenu.js'
import { usePanelTheme } from './use_panel_theme.js'
import { EnvironmentIndicator } from './EnvironmentIndicator.js'
import { ClusterNavigation } from './ClusterNavigation.js'

const contentWidths: Record<string, string> = {
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

/**
 * Panel shell: sidebar (brand, tenant switcher, navigation) or top navigation,
 * a topbar (search, notifications, user menu), and the page header
 * (breadcrumbs, title, header actions, record sub-navigation).
 */
export function Shell({
  panel,
  user,
  impersonation,
  locale,
  locales,
  nav,
  breadcrumbs,
  title,
  headerActions,
  subNavigation = [],
  clusterNavigation = [],
  clusterNavigationPosition = 'start',
  currentUrl,
  tenant,
  tenants,
  notifications,
  environment,
  children,
}: ShellProps) {
  const mainId = useId()
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
  const shellRef = useRef<HTMLDivElement>(null)
  const applySidebarToggle = () =>
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      try {
        window.localStorage.setItem(`pupitre:${panel.id}:sidebar-collapsed`, String(next))
      } catch {
        // Keep the in-memory toggle available when storage is disabled.
      }
      return next
    })
  // The rail and the expanded sidebar have different layouts, so the toggle morphs
  // between snapshots instead of transitioning individual properties.
  const toggleSidebar = () => {
    const shell = shellRef.current
    if (
      !shell ||
      typeof document.startViewTransition !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return applySidebarToggle()
    shell.dataset.sidebarMorph = ''
    void document
      .startViewTransition(() => flushSync(applySidebarToggle))
      .finished.finally(() => delete shell.dataset.sidebarMorph)
  }
  const collapsed = panel.theme?.sidebarCollapsibleOnDesktop
    ? sidebarCollapsed
    : panel.theme?.sidebar === 'collapsed'
  const maxContentWidth = contentWidths[panel.theme?.contentWidth ?? '7xl'] ?? '80rem'
  const closeMobile = () => setMobileOpen(false)

  const tools = (
    <div className="flex shrink-0 items-center gap-1">
      <EnvironmentIndicator environment={environment} />
      <NotificationTray notifications={notifications} />
      <UserMenu panel={panel} user={user} locale={locale} locales={locales} />
    </div>
  )

  return (
    <div
      ref={shellRef}
      data-pupitre-shell=""
      className={cn(
        'min-h-dvh bg-background font-sans text-foreground antialiased',
        topNav
          ? 'flex flex-col'
          : cn(
              'md:grid',
              collapsed ? 'md:grid-cols-[4rem_minmax(0,1fr)]' : 'md:grid-cols-[16rem_minmax(0,1fr)]'
            )
      )}
      data-density={panel.theme?.density ?? 'comfortable'}
      data-sidebar={panel.theme?.sidebar ?? 'expanded'}
      style={style}
    >
      <a
        href={`#${mainId}`}
        className="sr-only rounded-lg bg-card px-3 py-2 text-sm font-medium text-foreground shadow-popover focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[200] focus:outline-none focus:ring-[3px] focus:ring-ring/40"
      >
        {t('Skip to content')}
      </a>

      {!topNav && (
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
          <div
            className={cn(
              'flex shrink-0 items-center gap-2 px-3',
              collapsed ? 'flex-col justify-center py-3' : 'h-14 justify-between'
            )}
          >
            <ShellBrand panel={panel} compact={collapsed} />
            {panel.theme?.sidebarCollapsibleOnDesktop && (
              <Tooltip label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')} side="right">
                <Button
                  variant="ghost"
                  size="sm"
                  square
                  aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
                  onClick={toggleSidebar}
                >
                  <Icon name={collapsed ? 'panel-left-open' : 'panel-left-close'} />
                </Button>
              </Tooltip>
            )}
          </div>
          {!collapsed && (
            <div className="px-3 pb-2">
              <TenantSwitcher tenant={tenant} tenants={tenants} />
            </div>
          )}
          <ShellSidebar
            panel={panel}
            nav={nav}
            currentUrl={currentUrl}
            onNavigate={closeMobile}
            collapsed={collapsed}
          />
        </aside>
      )}

      {topNav && (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <ShellBrand panel={panel} />
          <TenantSwitcher tenant={tenant} tenants={tenants} compact />
          <ShellSidebar
            panel={panel}
            nav={nav}
            currentUrl={currentUrl}
            onNavigate={closeMobile}
            topNav
          />
          <div className="ml-auto flex items-center gap-2">
            <GlobalSearch search={panel.search} compact />
            {tools}
          </div>
        </header>
      )}

      <div data-pupitre-content="" className="flex min-w-0 flex-col">
        {!topNav && (
          <header
            aria-label={t('Panel toolbar')}
            className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6 lg:px-8"
          >
            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Trigger
                aria-label={t('Open navigation')}
                className="-ml-1.5 grid size-9 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 md:hidden"
              >
                <Icon name="menu" className="size-5" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className={backdropClasses} />
                <Dialog.Popup
                  data-pupitre-popup=""
                  className="fixed inset-y-0 left-0 z-[101] flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-dialog outline-none transition-transform duration-250 ease-drawer data-ending-style:-translate-x-full data-starting-style:-translate-x-full"
                  style={style}
                >
                  <Dialog.Title className="sr-only">{t('Navigation')}</Dialog.Title>
                  <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
                    <ShellBrand panel={panel} onNavigate={closeMobile} />
                    <Dialog.Close
                      aria-label={t('Close navigation')}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30"
                    >
                      <Icon name="x" className="size-4" />
                    </Dialog.Close>
                  </div>
                  <div className="px-3 pb-2">
                    <TenantSwitcher tenant={tenant} tenants={tenants} />
                  </div>
                  <ShellSidebar
                    panel={panel}
                    nav={nav}
                    currentUrl={currentUrl}
                    onNavigate={closeMobile}
                  />
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            <GlobalSearch search={panel.search} />
            <div className="ml-auto">{tools}</div>
          </header>
        )}

        <main
          id={mainId}
          tabIndex={-1}
          className="mx-auto w-full min-w-0 flex-1 px-4 pb-16 pt-6 outline-none sm:px-6 lg:px-8 lg:pt-8"
          style={{ maxWidth: maxContentWidth }}
        >
          <ImpersonationBanner impersonation={impersonation} />
          <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              {breadcrumbs.length > 0 && (
                <nav aria-label={t('Breadcrumb')} className="mb-1.5">
                  <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[0.8125rem] text-muted-foreground">
                    {breadcrumbs.map((crumb, index) => (
                      <li
                        key={`${crumb.label}-${index}`}
                        className="inline-flex min-w-0 items-center gap-1"
                      >
                        {index > 0 && (
                          <Icon
                            name="chevron-right"
                            className="size-3.5 shrink-0 text-subtle-foreground"
                          />
                        )}
                        {crumb.url && index < breadcrumbs.length - 1 ? (
                          <NavLink
                            href={crumb.url}
                            className="truncate rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                          >
                            {crumb.label}
                          </NavLink>
                        ) : (
                          <span aria-current="page" className="truncate text-foreground/80">
                            {crumb.label}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <h1 className="font-display text-[1.875rem] font-normal leading-9 tracking-[-0.01em] text-foreground text-balance">
                {title}
              </h1>
            </div>
            {headerActions.length > 0 && (
              <ActionList
                actions={headerActions}
                promotePrimary
                max={3}
                className="sm:ml-auto sm:justify-end"
              />
            )}
          </header>
          <div
            className={cn(
              clusterNavigation.length > 0 &&
                clusterNavigationPosition === 'start' &&
                'lg:flex lg:items-start lg:gap-6'
            )}
          >
            <ClusterNavigation items={clusterNavigation} position={clusterNavigationPosition} />
            <div className="min-w-0 flex-1">
              {/* One tab (the page you are on) navigates nowhere; show tabs only with a choice. */}
              {subNavigation.length > 1 && (
                <nav
                  aria-label={t('Record navigation')}
                  className={cn(underlineTabListClasses, 'mb-6')}
                >
                  {subNavigation.map((item) => (
                    <NavLink
                      key={item.key}
                      href={item.url}
                      aria-current={item.active ? 'page' : undefined}
                      className={underlineTabClasses}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              )}
              {/* Header widgets, page content and footer widgets stack as separate panels. */}
              <div className="min-w-0 space-y-10">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
