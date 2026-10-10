import { Menu } from '@base-ui/react/menu'
import type { ShellProps } from '@rikology/pupitre-react'
import { useState } from 'react'
import { Icon } from '../icons.js'
import { ActionButton } from './ActionButton.js'

export function Shell({
  panel,
  user,
  nav,
  breadcrumbs,
  title,
  headerActions,
  currentUrl,
  children,
}: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const panelId = typeof panel['id'] === 'string' ? panel['id'] : 'Pupitre'
  const panelPath = typeof panel['path'] === 'string' ? panel['path'] : '/'
  const panelBrand = panel['brand'] as { name?: string; logo?: string } | undefined
  const userName = typeof user?.['name'] === 'string' ? user['name'] : ''
  const userEmail = typeof user?.['email'] === 'string' ? user['email'] : ''
  const userAvatar = typeof user?.['avatarUrl'] === 'string' ? user['avatarUrl'] : undefined
  const logoutUrl = typeof user?.['logoutUrl'] === 'string' ? user['logoutUrl'] : undefined

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
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
        <a href={panelPath} className="mb-6 flex min-h-10 items-center gap-3 px-2 font-semibold">
          {panelBrand?.logo ? (
            <img src={panelBrand.logo} alt="" className="size-8 object-contain" />
          ) : (
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Icon name="layout-dashboard" className="size-4" />
            </span>
          )}
          <span>{panelBrand?.name ?? panelId}</span>
        </a>
        <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto">
          {nav.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    item.active ??
                    Boolean(
                      item.url && (currentUrl === item.url || currentUrl.startsWith(`${item.url}/`))
                    )
                  return (
                    <li key={`${item.label}:${item.url ?? ''}`}>
                      <a
                        href={item.url ?? '#'}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noreferrer' : undefined}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors ${active ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted'}`}
                      >
                        {item.icon && <Icon name={item.icon} className="size-4 shrink-0" />}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {item.badge}
                          </span>
                        )}
                      </a>
                      {item.children?.length ? (
                        <ul className="ml-5 mt-1 space-y-1 border-l border-border pl-3">
                          {item.children.map((child) => (
                            <li key={child.label}>
                              <a
                                href={child.url ?? '#'}
                                className="block rounded px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                              >
                                {child.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </nav>
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
          {user && (
            <Menu.Root>
              <Menu.Trigger
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                aria-label="Open user menu"
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="size-6 rounded-full object-cover" />
                ) : (
                  <Icon name="user" className="size-4" />
                )}
                <span className="max-w-40 truncate">{userName}</span>
                <Icon name="chevron-down" className="size-3" />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side="bottom" align="end" sideOffset={6}>
                  <Menu.Popup className="z-50 min-w-56 rounded-md border border-border bg-background p-1 text-foreground shadow-lg outline-none">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{userName}</p>
                      <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                    </div>
                    {logoutUrl && (
                      <Menu.Item
                        className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted focus:bg-muted"
                        onClick={() => {
                          window.location.assign(logoutUrl)
                        }}
                      >
                        <Icon name="log-out" className="size-4" />
                        Log out
                      </Menu.Item>
                    )}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          )}
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
