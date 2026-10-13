import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export class PupitreMedia extends BaseModel {
  static table = 'pupitre_media'
  @column({ isPrimary: true }) declare id: number
  @column() declare disk: string
  @column() declare directory: string
  @column() declare path: string
  @column() declare visibility: 'public' | 'private'
  @column() declare filename: string
  @column() declare mime: string
  @column() declare size: number
  @column() declare width: number | null
  @column() declare height: number | null
  @column() declare alt: string | null
  @column() declare title: string | null
  @column() declare caption: string | null
  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? {})),
  })
  declare conversions: Record<string, string>
  @column() declare tenantId: string | null
  @column() declare uploadedBy: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
}
