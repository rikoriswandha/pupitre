import { defineResource, pages, table } from '@rikology/pupitre'
import Post from '#models/post'
import Revision from '#models/revision'

export default defineResource(Revision)
  .slug('revisions')
  .label('Revision')
  .pluralLabel('Revisions')
  .recordTitle('title')
  .parent(Post, 'post')
  .form((s) => [s.text('title').required(), s.textarea('body').required()])
  .table((t) =>
    t
      .columns([
        table.text('title').label('Title').sortable().searchable(),
        table.text('createdAt').label('Created').dateTime().sortable(),
      ])
      .deferLoading()
  )
  .infolist((s) => [s.textEntry('title'), s.textEntry('body'), s.textEntry('createdAt')])
  .pages({
    list: pages.list(),
    create: pages.create(),
    edit: pages.edit(),
    view: pages.view(),
  })
