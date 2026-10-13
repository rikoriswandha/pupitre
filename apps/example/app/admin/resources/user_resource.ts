import { actions, defineResource, pages, table } from '@rikology/pupitre'
import { shieldRolesField } from '@rikology/pupitre-shield'
import User from '#models/user'
import UserPolicy from '#policies/user_policy'
import { loginHistoryWidget } from '@rikology/pupitre'

export default defineResource(User)
  .slug('users')
  .label('User')
  .pluralLabel('Users')
  .icon('users')
  .navigation({ group: 'Administration', sort: 1 })
  .recordTitle('email')
  .globallySearchable(['fullName', 'email'])
  .globalSearchDetails((record) => [record.email])
  .policy(UserPolicy)
  .scope(false)
  .form((s) => [
    s
      .section('Account')
      .components([
        s.text('fullName').label('Full name').maxLength(160),
        s.email('email').required().maxLength(254).unique({ ignoreRecord: true }),
        s.text('timezone').label('Timezone').placeholder('Asia/Jakarta'),
        shieldRolesField(),
      ]),
  ])
  .table((t) =>
    t
      .columns([
        table.text('fullName').label('Name').searchable().sortable(),
        table.text('email').searchable().sortable(),
        table.text('timezone').label('Timezone'),
      ])
      .defaultSort('email', 'asc')
      .layout.grid({ default: 1, md: 2, xl: 3 })
  )
  .infolist((s) => [
    s.textEntry('fullName').label('Name'),
    s.textEntry('email'),
    s.textEntry('timezone'),
  ])
  .actions({
    header: [actions.create()],
    row: [actions.edit(), actions.view(), actions.impersonate()],
    bulk: [actions.delete()],
  })
  .pages({
    list: pages.list(),
    create: pages.create().redirectTo('edit'),
    edit: pages.edit(),
    view: pages.view().footerWidgets([loginHistoryWidget()]),
  })
