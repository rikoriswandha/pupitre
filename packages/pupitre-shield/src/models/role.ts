import { BaseModel, column, manyToMany, afterSave, afterDelete } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Permission from './permission.js'
import { invalidateShieldPermissions } from '../permissions.js'
export default class Role extends BaseModel {
  static table = 'pupitre_roles'
  @afterSave()
  @afterDelete()
  static invalidateGrants() {
    invalidateShieldPermissions()
  }
  @column({ isPrimary: true }) declare id: number
  @column() declare name: string
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
  @manyToMany(() => Permission, {
    pivotTable: 'pupitre_permission_role',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
  })
  declare permissions: ManyToMany<typeof Permission>
}
