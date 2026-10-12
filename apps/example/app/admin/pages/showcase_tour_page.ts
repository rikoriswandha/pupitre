import { definePage } from '@rikology/pupitre'

/** Showcase: a custom page whose whole UI is a host Inertia component. */
export default definePage('tour')
  .path('/tour')
  .title('Showcase tour')
  .icon('star')
  .navigation({ group: 'Showcase', sort: 4, label: 'Showcase tour' })
  .component('admin/showcase_tour')
