import type { PupitreOptions } from '@rikology/pupitre-ui/testing'

/** The seeded example admin panel (tenancy mode `url`, tenant `acme`). */
export const examplePanel: PupitreOptions = {
  panelPath: '/admin',
  basePath: '/admin/acme',
  landingPath: '/admin/acme/posts',
  email: 'admin@example.com',
  password: 'password',
}
