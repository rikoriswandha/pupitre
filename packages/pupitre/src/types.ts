// Type-only imports pull in the HttpContext augmentations (ctx.inertia, ctx.session)
// without loading those modules at runtime.
import type {} from '@adonisjs/inertia/inertia_middleware'
import type {} from '@adonisjs/session/session_middleware'
import type { PanelRuntime, default as PupitreManager } from './manager.js'
import type { PupitreConfig } from './define_config.js'

export type PupitreUser = {
  id: string | number
  name: string
  email: string
  avatarUrl?: string
  timezone?: string
} | null

export type PupitreContext = {
  panel: PanelRuntime
  locale: 'en'
  timezone: string
  user: PupitreUser
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    pupitre: PupitreContext
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'pupitre.manager': PupitreManager
    'pupitre.config': PupitreConfig
  }
}

export {}
