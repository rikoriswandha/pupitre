exports[`make:panel writes the stub once and preserves existing files 1`] = `"import { definePanel } from '@rikology/pupitre'
import { resources } from '#generated/admin'
import { middleware } from '#start/kernel'

export default definePanel('app')
  .path('/app')
  .guard('web')
  .middleware([middleware.auth({ guards: ['web'] })])
  .resources(resources)
"`

