import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type {
  ResolvedTenant,
  TenancyAdapter,
  TenancyDefinition,
  TenantSummary,
} from '../definition/tenancy.js'
import { E_PUPITRE_MISSING_PEER } from '../errors.js'

type TenantPeer = {
  runWithTenant(
    tenant: { id: string | number; name: string; slug: string },
    callback: () => Promise<void>
  ): Promise<void>
  PathResolver: new (options?: {
    lookup?: (
      segment: string
    ) => Promise<{ id: string | number; name: string; slug: string } | null>
  }) => {
    resolve(ctx: HttpContext): Promise<{ id: string | number; name: string; slug: string } | null>
  }
}

async function tenantPeer(): Promise<TenantPeer> {
  try {
    const [core, resolvers] = await Promise.all([
      import('@rikology/adonisjs-tenant'),
      import('@rikology/adonisjs-tenant/resolvers'),
    ])
    return { runWithTenant: core.runWithTenant, PathResolver: resolvers.PathResolver }
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND')
    )
      throw new E_PUPITRE_MISSING_PEER()
    throw error
  }
}

function attribute(record: LucidRow, name: string): unknown {
  const attrs = record as unknown as Record<string, unknown>
  if (attrs[name] !== undefined) return attrs[name]
  const model = record.constructor as LucidModel
  const property = model.$keys.columnsToAttributes.get(name)
  return property ? attrs[property] : undefined
}

function toTenant(record: LucidRow, definition: TenancyDefinition) {
  const id = attribute(record, 'id') as string | number
  const name = String(attribute(record, definition.titleAttribute) ?? id)
  const slug = String(attribute(record, definition.slugAttribute) ?? '')
  return { id, name, slug }
}

export async function createTenantDriver(definition: TenancyDefinition): Promise<TenancyAdapter> {
  if (!definition.model) throw new Error('The adonisjs-tenant driver requires tenancy.model')
  if (!definition.tenantsForUser)
    throw new Error(
      'The adonisjs-tenant driver requires tenantsForUser(user, ctx) for membership checks'
    )
  const peer = await tenantPeer()
  const tenantModel = await definition.model()
  const model = tenantModel.default
  const findBySlug = async (slug: string) => {
    const record = await model.query().where(definition.slugAttribute, slug).first()
    return record ? toTenant(record, definition) : null
  }
  const pathResolver = new peer.PathResolver({ lookup: findBySlug })
  const memberships = async (ctx: HttpContext) => {
    const user = ctx.pupitre.authUser
    return user ? definition.tenantsForUser!(user, ctx) : []
  }

  return {
    async resolve(ctx) {
      let found: { id: string | number; name: string; slug: string } | null = null
      if (definition.mode === 'url') {
        const pathRequest = Object.create(ctx.request) as HttpContext['request']
        Object.defineProperty(pathRequest, 'url', { value: () => `/${ctx.params.tenant}` })
        const pathContext = Object.create(ctx) as HttpContext
        Object.defineProperty(pathContext, 'request', { value: pathRequest })
        found = await pathResolver.resolve(pathContext)
      } else {
        const user = ctx.pupitre.authUser
        if (!user) return null
        const id = attribute(user, definition.currentTenantAttribute)
        if (id === undefined || id === null) return null
        const record = await model.find(id)
        found = record ? toTenant(record, definition) : null
      }
      if (!found) return null
      const members = await memberships(ctx)
      const member = members.find((record) => String(attribute(record, 'id')) === String(found!.id))
      if (!member) return null
      return { ...found, record: member }
    },
    scope(query: ModelQueryBuilderContract<LucidModel>, tenant: ResolvedTenant, options) {
      query.where(options.ownership, tenant.id)
    },
    fill(data: Record<string, unknown>, tenant: ResolvedTenant, options) {
      return { ...data, [options.ownership]: tenant.id }
    },
    async listForUser(ctx): Promise<TenantSummary[]> {
      const records = await memberships(ctx)
      return records.map((record) => {
        const tenant = toTenant(record, definition)
        return { ...tenant }
      })
    },
    async switch(ctx, tenantId) {
      const user = ctx.pupitre.authUser
      const userMemberships = await memberships(ctx)
      if (
        !user ||
        !userMemberships.some((record) => String(attribute(record, 'id')) === String(tenantId))
      )
        return false
      const row = user as LucidRow & {
        merge(values: Record<string, unknown>): LucidRow
        save(): Promise<unknown>
      }
      row.merge({ [definition.currentTenantAttribute]: tenantId })
      await row.save()
      return true
    },
    async run(tenant, next) {
      await peer.runWithTenant(
        { id: tenant.id, name: tenant.name, slug: tenant.slug ?? String(tenant.id) },
        next
      )
    },
  }
}
