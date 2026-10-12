exports[`make:resource scaffold > renders a resource from model introspection metadata 1`] = `"import { actions, defineResource, pages, schema, table } from '@rikology/pupitre'
import Fixture from '#models/fixture'

export default defineResource(Fixture)
  .slug('fixtures')
  .label('Fixture')
  .pluralLabel('Fixtures')
  .recordTitle('title')
  .form(() => [
      schema.text('title'),
      schema.toggle('active'),
      schema.number('rank'),
      schema.dateTime('happenedAt'),
      schema.date('birthday'),
      schema.select('state').options({\\"draft\\":\\"Draft\\",\\"published\\":\\"Published\\"}),
      schema.keyValue('metadata'),
      schema.select('authorId').relationship('author', 'name'),
  ])
  .table((t) => t.columns([
      table.text('title').label('Title').searchable().sortable(),
      table.icon('active').boolean().label('Active'),
      table.text('rank').label('Rank').numeric().sortable(),
      table.text('happenedAt').label('Happened At').sortable().dateTime(),
      table.text('birthday').label('Birthday').sortable().date(),
      table.badge('state').label('State').options({\\"draft\\":\\"Draft\\",\\"published\\":\\"Published\\"}).sortable(),
      table.text('metadata').label('Metadata'),
      table.text('author.name').label('Author').sortable(),
  ]))
  .infolist(() => [
      schema.textEntry('title').label('Title'),
      schema.iconEntry('active').label('Active').boolean(),
      schema.textEntry('rank').label('Rank'),
      schema.textEntry('happenedAt').label('Happened At').dateTime(),
      schema.textEntry('birthday').label('Birthday').date(),
      schema.badgeEntry('state').label('State').options({\\"draft\\":\\"Draft\\",\\"published\\":\\"Published\\"}),
      schema.textEntry('metadata').label('Metadata'),
      schema.textEntry('authorId').label('Author Id'),
  ])
  .actions({
    header: [actions.create()],
    row: [actions.edit(), actions.view(), actions.delete()],
  })
  .pages({
    list: pages.list(),
    create: pages.create(),
    edit: pages.edit(),
    view: pages.view(),
  })
"`

exports[`make:resource scaffold > renders a resource from migration column definitions 1`] = `"import { actions, defineResource, pages, schema, table } from '@rikology/pupitre'
import Fixture from '#models/fixture'

export default defineResource(Fixture)
  .slug('fixtures')
  .label('Fixture')
  .pluralLabel('Fixtures')
  .recordTitle('title')
  .form(() => [
      schema.text('title'),
      schema.toggle('active'),
      schema.number('rank'),
      schema.dateTime('happenedAt'),
      schema.date('birthday'),
      schema.select('state').options({\\"draft\\":\\"Draft\\",\\"published\\":\\"Published\\"}),
      schema.select('visibility').options({\\"private\\":\\"Private\\",\\"public\\":\\"Public\\"}),
      schema.keyValue('metadata'),
      schema.select('authorId').relationship('author', 'name'),
  ])
  .table((t) => t.columns([
      table.text('title').label('Title').searchable().sortable(),
      table.icon('active').boolean().label('Active'),
      table.text('rank').label('Rank').numeric().sortable(),
      table.text('happenedAt').label('Happened At').sortable().dateTime(),
      table.text('birthday').label('Birthday').sortable().date(),
      table.badge('state').label('State').options({\\"draft\\":\\"Draft\\",\\"published\\":\\"Published\\"}).sortable(),
      table.badge('visibility').label('Visibility').options({\\"private\\":\\"Private\\",\\"public\\":\\"Public\\"}).sortable(),
      table.text('metadata').label('Metadata'),
      table.text('author.name').label('Author').sortable(),
  ]))
  .infolist(() => [
      schema.textEntry('title').label('Title'),
      schema.iconEntry('active').label('Active').boolean(),
      schema.textEntry('rank').label('Rank'),
      schema.textEntry('happenedAt').label('Happened At').dateTime(),
      schema.textEntry('birthday').label('Birthday').date(),
      schema.badgeEntry('state').label('State').options({\\"draft\\":\\"Draft\\",\\"published\\":\\"Published\\"}),
      schema.badgeEntry('visibility').label('Visibility').options({\\"private\\":\\"Private\\",\\"public\\":\\"Public\\"}),
      schema.textEntry('metadata').label('Metadata'),
      schema.textEntry('authorId').label('Author Id'),
  ])
  .actions({
    header: [actions.create()],
    row: [actions.edit(), actions.view(), actions.delete()],
  })
  .pages({
    list: pages.list(),
    create: pages.create(),
    edit: pages.edit(),
    view: pages.view(),
  })
"`

