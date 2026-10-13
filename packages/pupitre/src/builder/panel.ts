import type { ImpersonationOptions } from '../definition/panel.js'
import type { EnvironmentIndicatorOptions } from '../definition/panel.js'
import type {
  PanelAuthDefinition,
  PanelDefinition,
  PanelThemeDefinition,
} from '../definition/panel.js'
import type { NavEntryDefinition, UserMenuItemDefinition } from '../definition/navigation.js'
import type { TenancyDefinition, TenancyMode } from '../definition/tenancy.js'
import { validateTheme } from '../definition/theme.js'
import type { WidgetFilterDefinition } from '../definition/widget.js'
import { stableJson } from '../definition/shared.js'
import type { PupitrePlugin } from '../definition/plugin.js'
import { supportedNumberLocale } from '../i18n/number_locale.js'

type Definable<T> = T | { toDefinition(): T }
export type TenancyInput = Partial<Omit<TenancyDefinition, 'mode'>> & { mode: TenancyMode }

export type PanelBuilder = {
  readonly definition: PanelDefinition
  impersonation(options?: ImpersonationOptions): PanelBuilder
  strictAuthorization(enabled?: boolean): PanelBuilder
  environmentIndicator(options?: EnvironmentIndicatorOptions): PanelBuilder
  path(value: string): PanelBuilder
  domain(value: string): PanelBuilder
  guard(value: string): PanelBuilder
  middleware(value: PanelDefinition['middleware']): PanelBuilder
  resources(value: readonly unknown[] | Record<string, unknown>): PanelBuilder
  pages(value: readonly unknown[] | Record<string, unknown>): PanelBuilder
  brand(value: NonNullable<PanelDefinition['brand']>): PanelBuilder
  theme(value: PanelThemeDefinition): PanelBuilder
  timezone(value: string): PanelBuilder
  locale(value: string): PanelBuilder
  locales(value: readonly string[]): PanelBuilder
  /** Default region for number and money separators (`id-ID` → `1.234,5`). */
  numberLocale(value: string): PanelBuilder
  /** Number formats offered in the profile; `[]` hides the choice. */
  numberLocales(value: readonly string[]): PanelBuilder
  breadcrumbs(value: boolean): PanelBuilder
  /** Serve the panel login/logout pages; `false` keeps the host's own auth. */
  login(enabled?: boolean): PanelBuilder
  registration(enabled?: boolean): PanelBuilder
  passwordReset(enabled?: boolean): PanelBuilder
  emailVerification(enabled?: boolean): PanelBuilder
  mfa(options?: { required?: boolean; issuer?: string } | false): PanelBuilder
  passkeys(enabled?: boolean): PanelBuilder
  profile(options?: boolean | { avatar?: boolean }): PanelBuilder
  sessions(options?: { history?: boolean; retentionDays?: number }): PanelBuilder
  social(providers: string[] | { providers: string[]; registration?: boolean }): PanelBuilder
  navigation(entries: readonly Definable<NavEntryDefinition>[]): PanelBuilder
  userMenu(items: readonly UserMenuItemDefinition[]): PanelBuilder
  tenancy(options: TenancyInput | false): PanelBuilder
  notifications(options?: { interval?: number } | false): PanelBuilder
  globalSearch(options?: { keyBinding?: string } | false): PanelBuilder
  widgets(value: readonly unknown[] | Record<string, unknown>): PanelBuilder
  filters(value: readonly WidgetFilterDefinition[]): PanelBuilder
  /** Plugins applied in order at boot (`definePlugin`). Replaces earlier `.plugins()` calls. */
  plugins(value: readonly PupitrePlugin[]): PanelBuilder
  toDefinition(): PanelDefinition
  toJSON(): string
}

function unwrap<T>(value: Definable<T> | unknown): T | unknown {
  if (
    value &&
    typeof value === 'object' &&
    'toDefinition' in value &&
    typeof value.toDefinition === 'function'
  ) {
    return value.toDefinition()
  }
  return value
}

function definitions(value: readonly unknown[] | Record<string, unknown>) {
  return Array.isArray(value) ? value.map((entry) => unwrap(entry)) : value
}

function withToJSON(definition: PanelDefinition): PanelDefinition {
  definition.toJSON = () =>
    stableJson(Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'toJSON')))
  return definition
}

class Panel implements PanelBuilder {
  constructor(readonly definition: PanelDefinition) {}
  private set(patch: Partial<PanelDefinition>): PanelBuilder {
    return new Panel(withToJSON({ ...this.definition, ...patch }))
  }
  private setAuth(patch: Partial<PanelAuthDefinition>): PanelBuilder {
    return this.set({ auth: { ...this.definition.auth, ...patch } })
  }
  impersonation(options: ImpersonationOptions = {}): PanelBuilder {
    return this.set({ impersonation: { ...options } })
  }
  strictAuthorization(enabled = true): PanelBuilder {
    return this.set({ strictAuthorization: enabled })
  }
  environmentIndicator(options: EnvironmentIndicatorOptions = {}): PanelBuilder {
    return this.set({ environmentIndicator: { ...options } })
  }
  path(value: string): PanelBuilder {
    return this.set({ path: value })
  }
  domain(value: string): PanelBuilder {
    return this.set({ domain: value })
  }
  guard(value: string): PanelBuilder {
    return this.set({ guard: value })
  }
  middleware(value: PanelDefinition['middleware']): PanelBuilder {
    return this.set({ middleware: [...value] })
  }
  resources(value: readonly unknown[] | Record<string, unknown>): PanelBuilder {
    return this.set({ resources: definitions(value) })
  }
  pages(value: readonly unknown[] | Record<string, unknown>): PanelBuilder {
    return this.set({ pages: definitions(value) })
  }
  brand(value: NonNullable<PanelDefinition['brand']>): PanelBuilder {
    return this.set({ brand: { ...value } })
  }
  theme(value: PanelThemeDefinition): PanelBuilder {
    validateTheme(value)
    return this.set({
      theme: {
        ...value,
        ...(value.font ? { font: { ...value.font } } : {}),
        ...(value.colors ? { colors: { ...value.colors } } : {}),
        ...(value.vars ? { vars: { ...value.vars } } : {}),
      },
    })
  }
  timezone(value: string): PanelBuilder {
    return this.set({ timezone: value })
  }
  locale(value: string): PanelBuilder {
    new Intl.PluralRules(value)
    return this.set({ locale: value })
  }
  locales(value: readonly string[]): PanelBuilder {
    if (!value.length || new Set(value).size !== value.length)
      throw new Error('Panel locales must be non-empty and unique')
    for (const locale of value) new Intl.PluralRules(locale)
    return this.set({ locales: [...value] })
  }
  numberLocale(value: string): PanelBuilder {
    return this.set({ numberLocale: supportedNumberLocale(value) })
  }
  numberLocales(value: readonly string[]): PanelBuilder {
    if (new Set(value).size !== value.length) throw new Error('Panel number locales must be unique')
    return this.set({ numberLocales: value.map(supportedNumberLocale) })
  }
  breadcrumbs(value: boolean): PanelBuilder {
    return this.set({ breadcrumbs: value })
  }
  login(enabled = true): PanelBuilder {
    return this.setAuth({ login: enabled })
  }
  registration(enabled = true): PanelBuilder {
    return this.setAuth({ registration: enabled })
  }
  passwordReset(enabled = true): PanelBuilder {
    return this.setAuth({ passwordReset: enabled })
  }
  emailVerification(enabled = true): PanelBuilder {
    return this.setAuth({ emailVerification: enabled })
  }
  mfa(options: { required?: boolean; issuer?: string } | false = {}): PanelBuilder {
    return this.setAuth({
      mfa:
        options === false
          ? undefined
          : { required: options.required ?? false, issuer: options.issuer ?? 'Pupitre' },
    })
  }
  passkeys(enabled = true): PanelBuilder {
    return this.setAuth({ passkeys: enabled ? { enabled: true } : undefined })
  }
  profile(options: boolean | { avatar?: boolean } = true): PanelBuilder {
    return this.setAuth({
      profile:
        typeof options === 'boolean'
          ? { enabled: options, avatar: options }
          : { enabled: true, avatar: options.avatar ?? true },
    })
  }
  sessions(options: { history?: boolean; retentionDays?: number } = {}): PanelBuilder {
    const retentionDays = options.retentionDays ?? 90
    if (!Number.isInteger(retentionDays) || retentionDays < 1)
      throw new Error('Session retentionDays must be a positive integer')
    return this.set({ sessions: { history: options.history ?? true, retentionDays } })
  }
  social(providers: string[] | { providers: string[]; registration?: boolean }): PanelBuilder {
    const options = Array.isArray(providers) ? { providers } : providers
    const normalized = [
      ...new Set(options.providers.map((provider) => provider.trim()).filter(Boolean)),
    ]
    if (normalized.some((provider) => !/^[a-z][a-z0-9_-]*$/i.test(provider)))
      throw new Error('Social login providers must be valid Ally provider names')
    return this.set({
      social: {
        providers: normalized,
        registration: options.registration ?? this.definition.social?.registration ?? false,
      },
    })
  }
  navigation(entries: readonly Definable<NavEntryDefinition>[]): PanelBuilder {
    return this.set({ navigation: entries.map((entry) => unwrap(entry) as NavEntryDefinition) })
  }
  userMenu(items: readonly UserMenuItemDefinition[]): PanelBuilder {
    return this.set({ userMenu: items.map((item) => ({ ...item })) })
  }
  tenancy(options: TenancyInput | false): PanelBuilder {
    if (options === false) return this.set({ tenancy: undefined })
    if (!options.model && !options.adapter)
      throw new Error('Panel tenancy requires either a tenant model or a custom adapter')
    if (!options.adapter && !options.tenantsForUser)
      throw new Error('Column tenancy requires tenantsForUser(user, ctx)')
    return this.set({
      tenancy: {
        ownership: 'tenant_id',
        slugAttribute: 'slug',
        titleAttribute: 'name',
        menu: true,
        currentTenantAttribute: 'currentTenantId',
        ...options,
      },
    })
  }
  notifications(options: { interval?: number } | false = {}): PanelBuilder {
    return this.set({
      notifications: options === false ? null : { interval: options.interval ?? 30_000 },
    })
  }
  globalSearch(options: { keyBinding?: string } | false = {}): PanelBuilder {
    return this.set({
      globalSearch: options === false ? null : { keyBinding: options.keyBinding ?? 'mod+k' },
    })
  }
  widgets(value: readonly unknown[] | Record<string, unknown>): PanelBuilder {
    return this.set({ widgets: definitions(value) as PanelDefinition['widgets'] })
  }
  filters(value: readonly WidgetFilterDefinition[]): PanelBuilder {
    return this.set({
      dashboardFilters: value.map((filter) => ({
        ...filter,
        options: filter.options.map((option) => ({ ...option })),
      })),
    })
  }
  plugins(value: readonly PupitrePlugin[]): PanelBuilder {
    const names = new Set<string>()
    for (const plugin of value) {
      if (!plugin || typeof plugin.name !== 'string')
        throw new Error('Panel plugins must be created with definePlugin()')
      if (names.has(plugin.name))
        throw new Error(`Pupitre plugin "${plugin.name}" is registered twice on panel`)
      names.add(plugin.name)
    }
    return this.set({ plugins: [...value] })
  }
  toDefinition(): PanelDefinition {
    return this.definition
  }
  toJSON(): string {
    return this.definition.toJSON()
  }
}

/** Wraps an existing panel definition in an (immutable) builder; used to run plugin `register()`. */
export function panelBuilder(definition: PanelDefinition): PanelBuilder {
  return new Panel(withToJSON({ ...definition }))
}

export function definePanel(id: string): PanelBuilder {
  return new Panel(
    withToJSON({
      id,
      path: `/${id}`,
      middleware: [],
      resources: [],
      pages: [],
      breadcrumbs: true,
      auth: {
        login: false,
        registration: false,
        passwordReset: false,
        emailVerification: false,
        profile: { enabled: false, avatar: false },
      },
      userMenu: [],
      plugins: [],
      social: undefined,
      notifications: null,
      globalSearch: { keyBinding: 'mod+k' },
      toJSON: () => '',
    })
  )
}
