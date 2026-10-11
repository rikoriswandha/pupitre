import { actions, defineResource, pages, schema, table } from '@rikology/pupitre'
import Comment from '#models/comment'

export default defineResource(Comment)
  .slug('comments')
  .label('Comment')
  .pluralLabel('Comments')
  .recordTitle('title')
  .form(() => [
    schema.text('title'),
    schema.text('body'),
    schema.select('postId').relationship('post', 'title'),
  ])
  .table((t) =>
    t.columns([
      table.text('title').label('Title').searchable().sortable(),
      table.text('body').label('Body').searchable().sortable(),
      table.text('post.title').label('Post').sortable(),
    ])
  )
  .infolist(() => [
    schema.textEntry('title').label('Title'),
    schema.textEntry('body').label('Body'),
    schema.textEntry('postId').label('Post Id'),
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
