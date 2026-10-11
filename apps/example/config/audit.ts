import { defineConfig, stores } from '@rikology/adonisjs-audit-trail'
import Tenant from '#models/tenant'

export default defineConfig({
  default: 'lucid',
  guarantee: 'best-effort',
  stores: { lucid: stores.lucid({ table: 'audits' }) },
  tenantResolver: async (ctx) => {
    // Router middleware precedes Pupitre tenancy resolution; use the route slug.
    if (typeof ctx.params.tenant !== 'string') return null
    const tenant = await Tenant.findBy('slug', ctx.params.tenant)
    return tenant ? String(tenant.id) : null
  },
  captureAuthEvents: false,
})
