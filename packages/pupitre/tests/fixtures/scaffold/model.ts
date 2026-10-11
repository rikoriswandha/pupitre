import type { DateTime } from 'luxon'

export default class FixtureModel {
  declare title: string
  declare active: boolean
  declare rank: number
  declare happenedAt: DateTime
  declare birthday: Date
  declare metadata: Record<string, unknown>
  declare state: string

  static table = 'scaffold_fixtures'
  static $columnsDefinitions = new Map([
    ['id', { columnName: 'id', isPrimary: true }],
    ['title', { columnName: 'title', meta: { type: 'string' } }],
    ['active', { columnName: 'active', meta: { type: 'boolean' } }],
    ['rank', { columnName: 'rank', meta: { type: 'number' } }],
    ['happenedAt', { columnName: 'happened_at', meta: { type: 'dateTime' } }],
    ['birthday', { columnName: 'birthday', meta: { type: 'date' } }],
    ['state', { columnName: 'state', meta: { enum: ['draft', 'published'] } }],
    ['metadata', { columnName: 'metadata', meta: { type: 'json' } }],
    ['authorId', { columnName: 'author_id', meta: { type: 'number' } }],
    ['createdAt', { columnName: 'created_at', meta: { type: 'dateTime' } }],
  ])
  static $relationsDefinitions = new Map([
    [
      'author',
      {
        type: 'belongsTo',
        foreignKey: 'authorId',
        relatedModel: { $columnsDefinitions: new Map([['name', { columnName: 'name' }]]) },
      },
    ],
    ['comments', { type: 'hasMany', foreignKey: 'fixtureId' }],
  ])
}
