import { configProvider } from '@adonisjs/core'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { MailAdapter } from './adapters/mail.js'
import type { NotificationsAdapter } from './adapters/notifications.js'
import type { JobsAdapter } from './adapters/jobs.js'
import type { AuditAdapter } from './adapters/audit.js'
import type { RealtimeAdapter } from './adapters/realtime.js'
import { validateMessages } from './i18n.js'
import type { LocaleMessages } from './i18n.js'

type Lazy<T> = T | (() => Promise<T>)

/** Attribute names (model properties, not DB columns) read on the host user model. */
export type AuthColumns = {
  name: string
  email: string
  password: string
  avatar: string
  emailVerifiedAt: string
  timezone: string
  locale: string
  /** Optional per-user number format preference (BCP 47 locale). */
  numberLocale?: string
  currentTenantId: string
  mfaSecret: string
  mfaRecoveryCodes: string
  mfaEnabledAt: string
  socialProvider?: string
  socialProviderId?: string
}

export interface PupitreConfig {
  cache: { dev: boolean }
  timezone: string
  i18n?: { fallbackLocale?: string; messages?: LocaleMessages }
  storage: { disk: string }
  policies?: () => Promise<Record<string, unknown>>
  auth: {
    /** Host user model used by panel auth pages; required when any auth page is enabled. */
    model?: () => Promise<{ default: LucidModel }>
    columns: AuthColumns
    /** Password reset token lifetime in minutes. */
    passwordResetTtl: number
    passkeys?: { rpId?: string; origin?: string; rpName?: string }
  }
  mail?: Lazy<MailAdapter>
  notifications?: Lazy<NotificationsAdapter>
  jobs?: Lazy<JobsAdapter>
  audit?: Lazy<AuditAdapter>
  realtime?: Lazy<RealtimeAdapter>
  exports?: { maxSyncRows?: number; maxAsyncRows?: number; retentionMinutes?: number }
}

export type PupitreConfigInput = Partial<
  Pick<
    PupitreConfig,
    'timezone' | 'policies' | 'mail' | 'notifications' | 'jobs' | 'exports' | 'audit' | 'i18n'
  >
> & {
  realtime?: PupitreConfig['realtime']
  cache?: Partial<PupitreConfig['cache']>
  storage?: Partial<PupitreConfig['storage']>
  auth?: Partial<Omit<PupitreConfig['auth'], 'columns'>> & {
    columns?: Partial<AuthColumns>
  }
}

const defaults: PupitreConfig = {
  cache: { dev: false },
  timezone: 'UTC',
  storage: { disk: 'uploads' },
  auth: {
    columns: {
      name: 'fullName',
      email: 'email',
      password: 'password',
      avatar: 'avatar',
      emailVerifiedAt: 'emailVerifiedAt',
      timezone: 'timezone',
      locale: 'locale',
      numberLocale: 'numberLocale',
      currentTenantId: 'currentTenantId',
      mfaSecret: 'mfaSecret',
      mfaRecoveryCodes: 'mfaRecoveryCodes',
      mfaEnabledAt: 'mfaEnabledAt',
      socialProvider: 'provider',
      socialProviderId: 'providerId',
    },
    passwordResetTtl: 60,
  },
  exports: { maxSyncRows: 1000, maxAsyncRows: 100_000, retentionMinutes: 1440 },
}

/** Resolves the configured config values, applying stable defaults. */
export function resolveConfig(config: PupitreConfigInput = {}): PupitreConfig {
  if (config.i18n?.messages) validateMessages(config.i18n.messages)
  if (config.i18n?.fallbackLocale) new Intl.PluralRules(config.i18n.fallbackLocale)
  return {
    ...defaults,
    ...config,
    cache: { ...defaults.cache, ...config.cache },
    storage: { ...defaults.storage, ...config.storage },
    auth: {
      ...defaults.auth,
      ...config.auth,
      columns: { ...defaults.auth.columns, ...config.auth?.columns },
    },
    exports: { ...defaults.exports, ...config.exports },
  }
}

/** Creates the resolved Pupitre configuration with stable defaults. */
export function defineConfig(config: PupitreConfigInput = {}) {
  return configProvider.create(async () => resolveConfig(config))
}

/** Resolves a lazily configured adapter (`value` or `() => Promise<value>`). */
export async function resolveAdapter<T extends object>(
  value: Lazy<T> | undefined
): Promise<T | undefined> {
  if (!value) return undefined
  return typeof value === 'function' ? (value as () => Promise<T>)() : value
}
