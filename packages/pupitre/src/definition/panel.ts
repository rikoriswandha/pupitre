import type { MiddlewareFn, ParsedNamedMiddleware } from '@adonisjs/http-server/types'
import type { NavEntryDefinition, UserMenuItemDefinition } from './navigation.js'
import type { TenancyDefinition } from './tenancy.js'

/** Built-in auth pages served by the panel (WP17). All default to disabled. */
export type PanelAuthDefinition = {
  login: boolean
  registration: boolean
  passwordReset: boolean
  emailVerification: boolean
  profile: { enabled: boolean; avatar: boolean }
}

export type PanelThemeDefinition = {
  primary?: string
  darkMode?: 'light' | 'dark' | 'system'
  radius?: string
  /** Extra CSS variables injected on the shell root, e.g. `{ '--sidebar': '...' }`. */
  vars?: Record<string, string>
}

export type PanelDefinition = {
  id: string
  path: string
  /** Route-group domain, e.g. `admin.example.com` or `:tenant.example.com`. */
  domain?: string
  guard?: string
  middleware: readonly (MiddlewareFn | ParsedNamedMiddleware)[]
  resources: readonly unknown[] | Record<string, unknown>
  /** Custom pages (`definePage`), same shape as `resources` (array or lazy barrel). */
  pages: readonly unknown[] | Record<string, unknown>
  brand?: { name: string; logo?: string; logoDark?: string; favicon?: string }
  theme?: PanelThemeDefinition
  timezone?: string
  locale?: 'en'
  breadcrumbs: boolean
  auth: PanelAuthDefinition
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
