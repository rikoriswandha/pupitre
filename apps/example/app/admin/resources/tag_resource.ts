import { actions, defineResource, pages, table } from '@rikology/pupitre'
import Tag from '#models/tag'

export default defineResource(Tag)
  .slug('tags')
  .label('Tag')
  .pluralLabel('Tags')
  .recordTitle('name')
  .form((s) => [s.text('name').required(), s.text('slug').required()])
  .table((t) =>
    t.columns([table.text('name').sortable().searchable(), table.text('slug').sortable()])
  )
  .actions({ row: [actions.delete()] })
  .pages({ list: pages.list().modals() })
