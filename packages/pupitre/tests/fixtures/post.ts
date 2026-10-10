import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Post extends BaseModel {
  @column() declare title: string
  @column() declare body: string
  @column() declare status: string
  @column() declare authorId: number
  @column() declare cover: string | null
  @column() declare metadata: Record<string, string>
  @column() declare items: { sku: string; qty: number }[]
  @column() declare createdAt: Date
}
