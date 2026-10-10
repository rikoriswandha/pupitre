import { configProvider } from '@adonisjs/core'

export interface PupitreConfig {
  path: string
  cache: { dev: boolean }
  timezone: string
  storage: { disk: string }
  policies?: () => Promise<Record<string, unknown>>
}

export type PupitreConfigInput = Partial<Pick<PupitreConfig, 'path' | 'timezone' | 'policies'>> & {
  cache?: Partial<PupitreConfig['cache']>
  storage?: Partial<PupitreConfig['storage']>
}

const defaults: PupitreConfig = {
  path: '/admin',
  cache: { dev: false },
  timezone: 'UTC',
  storage: { disk: 'uploads' },
}

/** Creates the resolved Pupitre configuration with stable defaults. */
export function defineConfig(config: PupitreConfigInput = {}) {
  return configProvider.create(async () => ({
    ...defaults,
    ...config,
    cache: { ...defaults.cache, ...config.cache },
    storage: { ...defaults.storage, ...config.storage },
  }))
}
