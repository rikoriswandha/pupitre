import { actions, definePanel, nav, pages } from '@rikology/pupitre'
import { middleware } from '#start/kernel'
import userResource from '../resources/user_resource.js'

export default definePanel('app')
  .path('/app')
  .guard('web')
  .middleware([middleware.auth({ guards: ['web'] })])
  .resources([
    userResource
      .actions({ header: [], row: [actions.view()], bulk: [] })
      .pages({ list: pages.list(), view: pages.view() }),
  ])
  .navigation([nav.group('Administration').items(['users'])])
  .brand({ name: 'Pupitre App' })
