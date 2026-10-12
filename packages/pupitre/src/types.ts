// Type-only imports pull in the HttpContext augmentations (ctx.inertia, ctx.session)
// without loading those modules at runtime.
import type {} from '@adonisjs/inertia/inertia_middleware'
import type {} from '@adonisjs/session/session_middleware'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { PanelRuntime, default as PupitreManager } from './manager.js'
import type { PupitreConfig } from './define_config.js'
import type { ResolvedTenant, TenancyAdapter } from './definition/tenancy.js'
export type PupitreUser = {
  id: string | number
  name: string
  email: string
  avatarUrl?: string
  timezone?: string
} | null

export type PupitreContext = {
  /**
   * Request-bound panel runtime. `panel.path` and every `resource.urls.*` include
   * the tenant segment in tenancy mode `url` (see `bindPanel`).
   */
  panel: PanelRuntime
  /** Panel path as declared (`/admin`), without tenant segment. */
  basePath: string
  locale: string
  timezone: string
  user: PupitreUser
  /** Authenticated host user model instance (guard user), when any. */
  authUser: LucidRow | null
  /** Current tenant (tenancy enabled and resolved), else `null`. */
  tenant: ResolvedTenant | null
  /** Adapter resolved by tenancy middleware for this request. */
  tenancyAdapter?: TenancyAdapter
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
