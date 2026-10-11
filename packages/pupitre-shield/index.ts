export { shield, shieldRolesField } from './src/plugin.js'
export {
  shieldCan,
  shieldAllows,
  invalidateShieldPermissions,
  shieldPolicyFor,
  shieldAbilities,
  resourceAbilities,
} from './src/permissions.js'
export type { ShieldOptions } from './src/permissions.js'
export { syncPermissions } from './src/sync.js'
export { default as Role } from './src/models/role.js'
export { default as Permission } from './src/models/permission.js'
export { configure } from './configure.js'
