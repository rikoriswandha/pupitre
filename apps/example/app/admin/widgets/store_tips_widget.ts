import { defineWidget } from '@rikology/pupitre'

/** Escape hatch: renders the host React component registered as `StoreTipsWidget`. */
export default defineWidget('store-tips')
  .heading('Where to look next')
  .span(2)
  .sort(8)
  .component('StoreTipsWidget', ({ ctx, filters }) => ({
    tenant: ctx.pupitre.tenant?.name ?? 'Global',
    channel: filters.channel ?? 'All',
  }))
