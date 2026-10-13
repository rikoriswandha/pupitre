import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
function consumeTimestamp(value: unknown): DateTime | null {
  if (value === null) return null
  if (DateTime.isDateTime(value)) return value
  if (value instanceof Date) return DateTime.fromJSDate(value, { zone: 'utc' })
  const iso = DateTime.fromISO(String(value), { zone: 'utc' })
  return iso.isValid ? iso : DateTime.fromSQL(String(value), { zone: 'utc' })
}
export default class Backup extends BaseModel {
  static table = 'pupitre_backups'
  static selfAssignPrimaryKey = true
  @column({ isPrimary: true }) declare id: string
  @column() declare disk: string
  @column() declare path: string
  @column() declare size: number
  @column() declare status: string
  @column() declare error: string | null
  @column() declare connection: string
  @column() declare dialect: string
  @column() declare createdBy: string | null
  @column() declare tenantId: string | null
  @column() declare activeLock: string | null
  @column.dateTime({ consume: consumeTimestamp }) declare startedAt: DateTime
  @column.dateTime({ consume: consumeTimestamp }) declare finishedAt: DateTime | null
}
