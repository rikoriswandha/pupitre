import { configProvider } from '@adonisjs/core'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { MailAdapter } from './adapters/mail.js'
import type { NotificationsAdapter } from './adapters/notifications.js'

type Lazy<T> = T | (() => Promise<T>)

/** Attribute names (model properties, not DB columns) read on the host user model. */
export type AuthColumns = {
  name: string
  email: string
  password: string
  avatar: string
  emailVerifiedAt: string
  timezone: string
  currentTenantId: string
}

export interface PupitreConfig {
  cache: { dev: boolean }
  timezone: string
  storage: { disk: string }
  policies?: () => Promise<Record<string, unknown>>
  auth: {
    /** Host user model used by panel auth pages; required when any auth page is enabled. */
    model?: () => Promise<{ default: LucidModel }>
    columns: AuthColumns
    /** Password reset token lifetime in minutes. */
    passwordResetTtl: number
  }
  mail?: Lazy<MailAdapter>
  notifications?: Lazy<NotificationsAdapter>
}

export type PupitreConfigInput = Partial<
  Pick<PupitreConfig, 'timezone' | 'policies' | 'mail' | 'notifications'>
> & {
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
      currentTenantId: 'currentTenantId',
    },
    passwordResetTtl: 60,
  },
}

/** Resolves the configured config values, applying stable defaults. */
export function resolveConfig(config: PupitreConfigInput = {}): PupitreConfig {
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
