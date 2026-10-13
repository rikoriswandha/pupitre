import { t } from '@rikology/pupitre-react'
import type { AuthShellProps } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { usePanelTheme } from './use_panel_theme.js'
import { PasskeyLogin } from './PasskeyLogin.js'
import { buttonClasses, ledgerRuleClasses } from '../primitives/index.js'
import { PanelNestingContext } from './Section.js'

/** Centered ledger sheet for auth pages (login, password reset, registration). */
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
  const socialProviders = Object.keys(panel.features)
    .filter((feature) => feature.startsWith('social:') && panel.features[feature])
    .map((feature) => feature.slice('social:'.length))
  return (
    <div
      className="grid min-h-dvh place-items-center bg-background px-4 py-12 text-foreground"
      style={style}
    >
      <main className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {panel.brand.logo || panel.brand.logoDark ? (
            <>
              {panel.brand.logo && (
                <img
                  src={panel.brand.logo}
                  alt=""
                  className={`h-10 w-auto max-w-40 object-contain ${panel.brand.logoDark ? 'dark:hidden' : ''}`}
                />
              )}
              {panel.brand.logoDark && (
                <img
                  src={panel.brand.logoDark}
                  alt=""
                  className={`h-10 w-auto max-w-40 object-contain ${panel.brand.logo ? 'hidden dark:block' : ''}`}
                />
              )}
            </>
          ) : (
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-lg bg-primary text-base font-bold text-primary-foreground"
            >
              {panel.brand.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <p className="text-sm font-semibold text-foreground">{panel.brand.name}</p>
        </div>
        <div className="[&_form]:space-y-5 [&_form_input]:w-full [&_form_button[type=submit]]:w-full [&_form_button[type=submit]]:bg-primary [&_form_button[type=submit]]:text-primary-foreground">
          <header className="pb-6">
            <h1 className="font-display text-[1.875rem] font-normal leading-9 tracking-[-0.01em]">
              {title}
            </h1>
            {title === t('Sign in') && (
              <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
                {t('Sign in to your account.')}
              </p>
            )}
          </header>
          <div className={`${ledgerRuleClasses} pt-6`}>
            <PanelNestingContext.Provider value={true}>{children}</PanelNestingContext.Provider>
          </div>
          {title === t('Sign in') && panel.features.passkeys && (
            <PasskeyLogin panelPath={panel.path} />
          )}
          {title === t('Sign in') && socialProviders.length > 0 && (
            <div className="mt-5 grid gap-2">
              <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>{t('or')}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              {socialProviders.map((provider) => (
                <a
                  key={provider}
                  href={`${panel.path}/auth/${encodeURIComponent(provider)}/redirect`}
                  className={buttonClasses({ color: 'gray', className: 'w-full' })}
                >
                  <Icon name="globe" className="size-4" />
                  {t('Continue with {provider}', { provider })}
                </a>
              ))}
            </div>
          )}
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
                className="rounded-sm text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
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
