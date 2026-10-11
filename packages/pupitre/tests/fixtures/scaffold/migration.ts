export default `
this.schema.createTable('scaffold_fixtures', (table) => {
  table.increments('id').notNullable()
  table.string('title').notNullable()
  table.boolean('active').notNullable()
  table.integer('rank').notNullable()
  table.timestamp('happened_at', { useTz: true }).nullable()
  table.date('birthday').nullable()
  table.enu('state', ['draft', 'published']).notNullable()
  table.string('visibility').checkIn(['private', 'public'])
  table.json('metadata').nullable()
  table.integer('author_id').references('id').inTable('users')
})
`
