import { t } from '@rikology/pupitre-react'
import type { AuthShellProps } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { usePanelTheme } from './use_panel_theme.js'

/** Centered card layout for auth pages (login, password reset, registration). */
export function AuthShell({ panel, title, children }: AuthShellProps) {
  const style = usePanelTheme(panel)
  const links = [
    ...(panel.features.login && title !== t('Sign in')
      ? [{ label: t('Sign in'), href: `${panel.path}/login` }]
      : []),
    ...(panel.features.passwordReset && title !== t('Forgot password')
      ? [{ label: t('Forgot password'), href: `${panel.path}/password/forgot` }]
      : []),
    ...(panel.features.registration && title !== t('Create account')
      ? [{ label: t('Create account'), href: `${panel.path}/register` }]
      : []),
  ]
  return (
    <div
      className="grid min-h-screen place-items-center bg-muted/40 px-4 py-10 text-foreground"
      style={style}
    >
      <main className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {panel.brand.logo ? (
            <img src={panel.brand.logo} alt="" className="size-10 object-contain" />
          ) : (
            <span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <Icon name="layout-dashboard" className="size-5" />
            </span>
          )}
          <p className="text-sm font-medium text-muted-foreground">{panel.brand.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
          {children}
        </div>
        {links.length > 0 && (
          <nav
            aria-label={t('Authentication')}
            className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm"
          >
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </main>
    </div>
  )
}
