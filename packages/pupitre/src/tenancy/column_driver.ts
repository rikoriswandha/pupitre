import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ResolvedTenant, TenantSummary, TenancyAdapter } from '../definition/tenancy.js'
import type { PanelRuntime } from '../manager.js'

function attributes(row: LucidRow): Record<string, unknown> {
  return row as unknown as Record<string, unknown>
}

function value(row: LucidRow, name: string): unknown {
  const direct = attributes(row)[name]
  if (direct !== undefined) return direct
  const attrName = (row.constructor as LucidModel).$keys.columnsToAttributes.get(name)
  return attrName ? attributes(row)[attrName] : undefined
}

function tenantFromRecord(record: LucidRow, panel: PanelRuntime): ResolvedTenant {
  const definition = panel.tenancy!
  const id = value(record, 'id')
  const name = value(record, definition.titleAttribute)
  const slug = value(record, definition.slugAttribute)
  return {
    id: id as string | number,
    name: String(name ?? id),
    ...(typeof slug === 'string' ? { slug } : {}),
    record,
  }
}

export function createColumnTenancyAdapter(panel: PanelRuntime): TenancyAdapter {
  const definition = panel.tenancy!
  if (!definition.model) throw new Error(`Panel "${panel.id}" tenancy requires a tenant model`)
  if (!definition.tenantsForUser)
    throw new Error(`Panel "${panel.id}" column tenancy requires tenantsForUser(user, ctx)`)

  const getMemberships = async (ctx: HttpContext) => {
    const user = ctx.pupitre.authUser
    if (!user) return []
    return definition.tenantsForUser!(user, ctx)
  }

  return {
    async resolve(ctx) {
      const user = ctx.pupitre.authUser
      if (!user) return null
      const memberships = await getMemberships(ctx)
      let record: LucidRow | undefined
      if (definition.mode === 'url') {
        const requestedSlug = ctx.params.tenant
        record = memberships.find(
          (tenant) => String(value(tenant, definition.slugAttribute)) === String(requestedSlug)
        )
        if (!record) return null
      } else {
        const currentTenantId = value(user, definition.currentTenantAttribute)
        record = memberships.find(
          (tenant) => String(value(tenant, 'id')) === String(currentTenantId)
        )
        if (!record) return null
      }
      return tenantFromRecord(record, panel)
    },
    scope(query: ModelQueryBuilderContract<LucidModel>, tenant: ResolvedTenant, options) {
      query.where(options.ownership, tenant.id)
    },
    fill(data: Record<string, unknown>, tenant: ResolvedTenant, options) {
      const property =
        options.model.$keys.columnsToAttributes.get(options.ownership) ?? options.ownership
      return { ...data, [property]: tenant.id }
    },
    async listForUser(ctx): Promise<TenantSummary[]> {
      const records = await getMemberships(ctx)
      return records.map((record) => {
        const resolved = tenantFromRecord(record, panel)
        return {
          id: resolved.id,
          name: resolved.name,
          ...(resolved.slug ? { slug: resolved.slug } : {}),
        }
      })
    },
    async switch(ctx, tenantId) {
      const user = ctx.pupitre.authUser
      if (!user) return false
      const memberships = await getMemberships(ctx)
      const membership = memberships.some(
        (tenant) => String(value(tenant, 'id')) === String(tenantId)
      )
      if (!membership) return false
      const instance = user as LucidRow & {
        merge(data: Record<string, unknown>): LucidRow
        save(): Promise<unknown>
      }
      instance.merge({ [definition.currentTenantAttribute]: tenantId })
      await instance.save()
      return true
    },
  }
}
