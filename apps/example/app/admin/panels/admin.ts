import { definePanel } from '@rikology/pupitre'
import { resources } from '#generated/admin'
import { middleware } from '#start/kernel'

export default definePanel('admin')
  .path('/admin')
  .guard('web')
  .middleware([middleware.auth({ guards: ['web'] })])
  .brand({ name: 'Pupitre Editorial' })
  .timezone('Asia/Jakarta')
  .resources(resources)