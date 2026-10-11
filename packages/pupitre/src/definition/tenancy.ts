import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

/** Serializable tenant identity exposed to controllers and the client. */
export type TenantSummary = {
  id: string | number
  name: string
  slug?: string
}

/** Resolved tenant for the current request. `record` is the host model instance when available. */
export type ResolvedTenant = TenantSummary & { record?: LucidRow | object }

/**
 * Tenancy adapter (DESIGN §Adapters). Implementations: default column driver
 * (`src/tenancy/column_driver.ts`) and `@rikology/pupitre/drivers/tenant`.
 */
export interface TenancyAdapter {
  /** Resolves the tenant for the request; `null` means "not found / not a member". */
  resolve(ctx: HttpContext): Promise<ResolvedTenant | null>
  /** Restricts a resource query to the tenant. */
  scope(
    query: ModelQueryBuilderContract<LucidModel>,
    tenant: ResolvedTenant,
    options: { ownership: string; model: LucidModel; ctx: HttpContext }
  ): void
  /** Fills ownership on create data (before persistence). */
  fill(
    data: Record<string, unknown>,
    tenant: ResolvedTenant,
    options: { ownership: string; model: LucidModel; ctx: HttpContext }
  ): Record<string, unknown>
  /** Tenants the user can switch to. */
  listForUser(ctx: HttpContext): Promise<TenantSummary[]>
  /** Implicit mode only: persists the user's current tenant. */
  switch?(ctx: HttpContext, tenantId: string | number): Promise<boolean>
  /** Optional execution context wrapper used by tenant-aware optional peers. */
  run?(tenant: ResolvedTenant, next: () => Promise<void>): Promise<void>
}

export type TenancyMode = 'url' | 'implicit'

export type TenancyDefinition = {
  mode: TenancyMode
  /** Lazy tenant model (default column driver). */
  model?: () => Promise<{ default: LucidModel }>
  /** Ownership column on resource tables; default `tenant_id`. */
  ownership: string
  /** Tenant attribute used in URLs (mode `url`); default `slug`. */
  slugAttribute: string
  /** Tenant attribute used as display name; default `name`. */
  titleAttribute: string
  /** Show the tenant switcher. */
  menu: boolean
  /** Custom adapter; defaults to the column driver. */
  adapter?: TenancyAdapter | (() => Promise<TenancyAdapter>)
  /** Default column driver: tenants the user belongs to. */
  tenantsForUser?: (user: LucidRow, ctx: HttpContext) => Promise<readonly LucidRow[]>
  /** Implicit mode: user attribute holding the current tenant id; default `currentTenantId`. */
  currentTenantAttribute: string
}
