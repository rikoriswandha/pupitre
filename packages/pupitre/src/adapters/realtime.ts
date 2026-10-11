import type { RealtimeEvent } from '../../catalog/wire.js'
import type PupitreManager from '../manager.js'

/** Transport-neutral ping publisher. Channel authorization belongs to the adapter. */
export interface RealtimeAdapter {
  driver: string
  publish(channel: string, event: RealtimeEvent): Promise<void>
  initialize?(manager: PupitreManager): void | Promise<void>
}

const segment = (value: string | number) => encodeURIComponent(String(value))

/** Stable channels with individually URI-encoded identifiers. */
export const realtimeChannels = {
  patterns: {
    user: 'pupitre/:panel/users/:id',
    resource: 'pupitre/:panel/resources/:resource',
    tenantResource: 'pupitre/:panel/tenants/:tenant/resources/:resource',
  },
  user(panelId: string, userId: string | number): string {
    return this.patterns.user.replace(':panel', segment(panelId)).replace(':id', segment(userId))
  },
  resource(panelId: string, slug: string, tenantId?: string | number | null): string {
    const pattern =
      tenantId === undefined || tenantId === null
        ? this.patterns.resource
        : this.patterns.tenantResource.replace(':tenant', segment(tenantId))
    return pattern.replace(':panel', segment(panelId)).replace(':resource', segment(slug))
  },
}
