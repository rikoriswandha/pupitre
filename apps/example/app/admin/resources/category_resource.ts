import { actions, defineResource, pages, table } from '@rikology/pupitre'
import Category from '#models/category'
import CategoryPolicy from '#policies/category_policy'

export default defineResource(Category)
  .slug('categories')
  .label('Category')
  .pluralLabel('Categories')
  .icon('tag')
  .navigation({ group: 'Content', sort: 2 })
  .recordTitle('name')
  .policy(CategoryPolicy)
  .form((s) => [
    s.section('Category').components([
      s
        .text('name')
        .required()
        .maxLength(120)
        .live()
        .afterStateUpdated(({ set, get }) => set('slug', get('name'))),
      s.text('slug').required().maxLength(140).unique({ ignoreRecord: true }),
    ]),
  ])
  .table((t) =>
    t
      .columns([
        table.text('name').searchable().sortable(),
        table.text('slug').searchable().sortable(),
      ])
      .defaultSort('name', 'asc')
  )
  .infolist((s) => [s.textEntry('name'), s.textEntry('slug').copyable()])
  .actions({
    header: [actions.create()],
    row: [actions.edit(), actions.view()],
    bulk: [actions.delete()],
  })
  .pages({
    list: pages.list(),
    create: pages.create().redirectTo('edit'),
    edit: pages.edit(),
    view: pages.view(),
  })
