export default class SchemaPost {
  static readonly $columns = ['title', 'status', 'publishedAt'] as const
  declare title: string
  declare status: string
  declare publishedAt: Date | null
  helper(): string {
    return ''
  }
}
