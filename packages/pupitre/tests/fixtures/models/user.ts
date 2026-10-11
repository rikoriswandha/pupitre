import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Post from './post.js'

export default class User extends BaseModel {
  static table = 'users'

  @column({ isPrimary: true }) declare id: number
  @column() declare name: string
  @column({ columnName: 'full_name' }) declare fullName: string | null
  @column() declare email: string
  @column() declare password: string | null
  @column.dateTime({ columnName: 'email_verified_at' }) declare emailVerifiedAt: DateTime | null
  @column() declare avatar: string | null
  @column() declare timezone: string | null
  @column({ columnName: 'current_tenant_id' }) declare currentTenantId: number | null
  @column() declare provider: string | null
  @column({ columnName: 'provider_id' }) declare providerId: string | null
  @column.dateTime({ columnName: 'mfa_enabled_at' }) declare mfaEnabledAt: DateTime | null
  @column() declare mfaSecret: string | null
  @column() declare mfaRecoveryCodes: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime

  static async verifyCredentials(email: string, password: string) {
    const user = await this.findBy('email', email)
    if (!user || user.password !== password) throw new Error('Invalid credentials')
    return user
  }

  @hasMany(() => Post, { foreignKey: 'authorId' }) declare posts: HasMany<typeof Post>
}
