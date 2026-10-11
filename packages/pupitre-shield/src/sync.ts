import type { PanelRuntime } from '@rikology/pupitre'
import Permission from './models/permission.js'
import Role from './models/role.js'
import {
  invalidateShieldPermissions,
  resourceAbilities,
  type ShieldOptions,
} from './permissions.js'
export async function syncPermissions(
  panels: PanelRuntime[],
  options?: ShieldOptions,
  userIdentity?: string
) {
  const names = [
    ...new Set(
      panels.flatMap((panel) =>
        panel.resources.flatMap((resource) =>
          (typeof resource.definition.policy === 'function' &&
          'permissionAbilities' in resource.definition.policy
            ? (resource.definition.policy.permissionAbilities as string[])
            : resourceAbilities(resource.definition)
          ).map((ability) => resource.slug + '.' + ability)
        )
      )
    ),
  ].sort()
  await Permission.fetchOrCreateMany(
    'name',
    names.map((name) => ({ name }))
  )
  if (options) {
    const role = await Role.firstOrCreate({ name: options.superAdminRole ?? 'super-admin' })
    if (userIdentity) {
      const { default: User } = await options.userModel()
      const user = await User.query()
        .where(userIdentity.includes('@') ? 'email' : User.primaryKey, userIdentity)
        .firstOrFail()
      await Role.query().client.transaction(async (trx) => {
        const exists = await trx
          .from('pupitre_role_user')
          .where({ role_id: role.id, user_id: user.$primaryKeyValue })
          .first()
        if (!exists)
          await trx
            .table('pupitre_role_user')
            .insert({ role_id: role.id, user_id: user.$primaryKeyValue })
      })
      invalidateShieldPermissions()
    }
  }
  return names
}
