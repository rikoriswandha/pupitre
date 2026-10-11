import type { MiddlewareFn, ParsedNamedMiddleware } from '@adonisjs/http-server/types'
import type { NavEntryDefinition, UserMenuItemDefinition } from './navigation.js'
import type { TenancyDefinition } from './tenancy.js'
import type { ThemeDefinition } from './theme.js'
import type { WidgetFilterDefinition } from './widget.js'
/** Built-in auth pages served by the panel (WP17). All default to disabled. */
export type PanelAuthDefinition = {
  login: boolean
  registration: boolean
  passwordReset: boolean
  emailVerification: boolean
  profile: { enabled: boolean; avatar: boolean }
  mfa?: PanelMfaDefinition
  passkeys?: PanelPasskeysDefinition
}

export type PanelMfaDefinition = { required: boolean; issuer: string }
export type PanelPasskeysDefinition = { enabled: boolean }
export type PanelSocialDefinition = {
  providers: string[]
  registration: boolean
}

export type PanelThemeDefinition = ThemeDefinition

export type PanelDefinition = {
  id: string
  path: string
  brand?: { name: string; logo?: string; logoDark?: string; favicon?: string }
  /** Route-group domain, e.g. `admin.example.com` or `:tenant.example.com`. */
  domain?: string
  guard?: string
  middleware: readonly (MiddlewareFn | ParsedNamedMiddleware)[]
  resources: readonly unknown[] | Record<string, unknown>
  /** Custom pages (`definePage`), same shape as `resources` (array or lazy barrel). */
  pages: readonly unknown[] | Record<string, unknown>
  /** Dashboard widget definitions registered on this panel. */
  widgets?: readonly unknown[] | Record<string, unknown>
  dashboardFilters?: readonly WidgetFilterDefinition[]
  theme?: PanelThemeDefinition
  timezone?: string
  locale?: 'en'
  breadcrumbs: boolean
  auth: PanelAuthDefinition
  social?: PanelSocialDefinition
  /** Explicit navigation; when absent, nav is derived from resources/pages. */
  navigation?: NavEntryDefinition[]
  userMenu: UserMenuItemDefinition[]
  tenancy?: TenancyDefinition
  /** Database notifications tray + polling interval (ms); `null` disables. */
  notifications: { interval: number } | null
  /** Global search; `null` disables. */
  globalSearch: { keyBinding: string } | null
  toJSON(): string
}
