import { HttpContext } from '@adonisjs/core/http'
import { BasePolicy } from '@adonisjs/bouncer'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ResourceDefinition } from '@rikology/pupitre'
import type Role from './models/role.js'
export type ShieldOptions = {
  superAdminRole?: string
  resources?: 'all' | string[]
  except?: string[]
  navigationGroup?: string
  userModel: () => Promise<{ default: LucidModel }>
}
export const shieldAbilities = [
  'viewAny',
  'view',
  'create',
  'update',
  'delete',
  'restore',
  'forceDelete',
  'replicate',
  'reorder',
  'attach',
  'detach',
  'associate',
  'dissociate',
] as const
type AbilityResource = Pick<ResourceDefinition, 'slug' | 'actions'> &
  Partial<Pick<ResourceDefinition, 'pages' | 'form' | 'table' | 'infolist'>>
export function resourceAbilities(resource: AbilityResource): string[] {
  const abilities = new Set<string>(shieldAbilities)
  const visited = new WeakSet<object>()
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || visited.has(value)) return
    visited.add(value)
    if ('can' in value && typeof value.can === 'string') abilities.add(value.can)
    for (const child of Object.values(value)) visit(child)
  }
  for (const source of [
    resource.actions,
    resource.pages,
    resource.form,
    resource.table,
    resource.infolist,
  ])
    visit(source)
  return [...abilities]
}
type Grants = { roles: Set<string>; permissions: Set<string> }
let cache = new WeakMap<HttpContext, Map<string, Promise<Grants>>>()
let resolved = new WeakMap<HttpContext, Map<string, Grants>>()
/** Call after host-managed role assignments or permission pivots change. */
export function invalidateShieldPermissions() {
  cache = new WeakMap()
  resolved = new WeakMap()
}
export async function shieldAllows(
  ctx: HttpContext,
  user: unknown,
  permission: string,
  options: Pick<ShieldOptions, 'superAdminRole'> = {},
  trx?: TransactionClientContract
): Promise<boolean> {
  if (!user || typeof user !== 'object') return false
  // Lucid exposes column values through its Proxy, not the `in` operator.
  const userId: unknown = Reflect.get(user, 'id')
  if (typeof userId !== 'string' && typeof userId !== 'number') return false
  const id = String(userId)
  const load = async (): Promise<Grants> => {
    const client = trx ?? (await ctx.containerResolver.make('lucid.db'))
    const rows: { role: string; permission: string | null }[] = await client
      .from('pupitre_role_user as ru')
      .join('pupitre_roles as r', 'r.id', 'ru.role_id')
      .leftJoin('pupitre_permission_role as pr', 'pr.role_id', 'r.id')
      .leftJoin('pupitre_permissions as p', 'p.id', 'pr.permission_id')
      .where('ru.user_id', id)
      .select('r.name as role', 'p.name as permission')
    return {
      roles: new Set(rows.map((row) => String(row.role))),
      permissions: new Set(
        rows.filter((row) => row.permission !== null).map((row) => String(row.permission))
      ),
    }
  }
  // Transaction snapshots must neither consume nor populate the request's pool cache.
  // Read fresh so pivot writes within the same transaction are visible as well.
  let pending: Promise<Grants>
  if (trx) {
    pending = load()
  } else {
    let users = cache.get(ctx)
    if (!users) {
      users = new Map()
      cache.set(ctx, users)
    }
    pending = users.get(id) ?? load()
    users.set(id, pending)
  }
  const grants = await pending
  if (!trx) {
    let users = resolved.get(ctx)
    if (!users) {
      users = new Map()
      resolved.set(ctx, users)
    }
    users.set(id, grants)
  }
  return (
    grants.roles.has(options.superAdminRole ?? 'super-admin') || grants.permissions.has(permission)
  )
}
/** Synchronous request-form checks; middleware warms these grants before rendering. */
export function shieldAllowsSync(
  ctx: HttpContext,
  permission: string,
  options: Pick<ShieldOptions, 'superAdminRole'> = {}
) {
  const user = ctx.pupitre.authUser
  if (!user || typeof user !== 'object') return false
  const grants = resolved.get(ctx)?.get(String(Reflect.get(user, 'id')))
  return Boolean(
    grants &&
    (grants.roles.has(options.superAdminRole ?? 'super-admin') ||
      grants.permissions.has(permission))
  )
}
export function shieldPolicyFor(
  resource: Pick<ResourceDefinition, 'slug' | 'actions'>,
  options: Pick<ShieldOptions, 'superAdminRole'> = {}
) {
  class ShieldPolicy extends BasePolicy {
    static permissionAbilities = resourceAbilities(resource)
    static containerInjections = {
      _constructor: {
        dependencies: [HttpContext],
        createError: (message: string) => new Error(message),
      },
    }
    constructor(public ctx: HttpContext) {
      super()
    }
    async before(user: unknown) {
      return (await shieldAllows(this.ctx, user, '', options)) ? true : undefined
    }
  }
  for (const ability of resourceAbilities(resource)) {
    Object.defineProperty(ShieldPolicy.prototype, ability, {
      value: async function (this: ShieldPolicy, user: unknown, record?: unknown) {
        if (
          resource.slug === 'roles' &&
          record &&
          typeof record === 'object' &&
          Reflect.get(record, 'name') === (options.superAdminRole ?? 'super-admin') &&
          !['viewAny', 'view'].includes(ability) &&
          !(await shieldAllows(this.ctx, user, '', options))
        )
          return false
        if (!(await shieldAllows(this.ctx, user, resource.slug + '.' + ability, options)))
          return false
        if (
          resource.slug === 'roles' &&
          ability === 'delete' &&
          record &&
          !(await shieldAllows(this.ctx, user, '', options))
        ) {
          const permissions = await (record as Role).related('permissions').query()
          for (const permission of permissions) {
            if (!(await shieldAllows(this.ctx, user, permission.name, options))) return false
          }
        }
        return true
      },
    })
  }
  return ShieldPolicy
}
export function shieldCan(permission: string, options: Pick<ShieldOptions, 'superAdminRole'> = {}) {
  return (ctx: HttpContext) => {
    const auth: unknown = Reflect.get(ctx, 'auth')
    const user: unknown = auth && typeof auth === 'object' ? Reflect.get(auth, 'user') : undefined
    return shieldAllows(ctx, user, permission, options)
  }
}
