---
title: "Transmit: realtime refresh"
description: "Configure authenticated server-sent event refreshes with AdonisJS Transmit and Pupitre server and browser adapters."
sidebar:
  label: "Transmit"
---

`@rikology/pupitre-transmit` bridges AdonisJS Transmit to Pupitre's realtime adapter and browser client. Despite living alongside panel plugins, it is configured through `realtime`, not `.plugins([...])`.

## Host setup

```sh
node ace add @adonisjs/transmit
npm install @rikology/pupitre-transmit @adonisjs/transmit-client
```

Configure the Transmit provider and `config/transmit.ts` following its host setup. The example registers `@adonisjs/transmit/transmit_provider`. Register Transmit's routes with the host's session/auth middleware:

```ts
// start/routes.ts
import transmit from '@adonisjs/transmit/services/main'
import { middleware } from '#start/kernel'

transmit.registerRoutes((route) => route.use(middleware.auth()))
```

Keep CSRF protection enabled. Set AdonisJS Shield's `csrf.enableXsrfCookie` to `true` for protected subscribe/unsubscribe requests. The browser bridge copies the `XSRF-TOKEN` cookie into `X-XSRF-TOKEN`; this is AdonisJS Shield, not the Pupitre roles plugin.

```ts
// config/pupitre.ts
import { defineConfig } from '@rikology/pupitre'
import { transmitRealtime } from '@rikology/pupitre-transmit'

export default defineConfig({ realtime: transmitRealtime() })
```

`transmitRealtime({ service? })` optionally accepts a compatible Transmit service for isolated tests. Route registration remains the host's responsibility.

## Connect the browser

```tsx
// inertia/pages/pupitre.tsx
import { Pupitre } from '@rikology/pupitre-react'
import { transmitRealtimeClient } from '@rikology/pupitre-transmit/client'
import { registry } from '../admin/registry.js'

const realtime = transmitRealtimeClient()

export default function PupitrePage() {
  return <Pupitre registry={registry} realtime={realtime} />
}
```

Reuse a stable client instance. Creating it is SSR-safe; browser resources are created on first subscription. `transmitRealtimeClient(options?)` accepts partial Transmit constructor options, including `baseUrl` and request hooks. Its default base URL is the browser origin. Custom `beforeSubscribe` and `beforeUnsubscribe` hooks run after the built-in XSRF header logic. Same-channel listeners share subscriptions, payloads are catalog-validated, and the last listener's cleanup removes the subscription.

## Channels and events

Identifiers are individually URI-encoded:

| Channel | Event |
| --- | --- |
| `pupitre/<panel>/users/<userId>` | `{ type: 'pupitre:notification' }` |
| `pupitre/<panel>/resources/<slug>` | `{ type: 'pupitre:table', resource: '<slug>' }` |
| `pupitre/<panel>/tenants/<tenantId>/resources/<slug>` | Same table ping, scoped to a tenant |

Events contain **no record or notification content**. Table pings trigger authorized partial reloads; notification pings reload shared Pupitre props and an already-open inbox. This is invalidation, not record replication or live collaborative editing.

An inbox notification publishes a ping to the user's channel in **every notifications-enabled panel**, not just the panel that initiated it. Store inbox messages before publishing. Resource pings publish only after the mutation commits; delivery is best effort.

## What channel authorization enforces

Transmit reuses the core `panelGuard(panel)` selection and `realtimeChannels.patterns` for user, resource and tenant-resource authorization; it does not maintain a separate guard or channel naming convention.

- A known panel and its configured auth guard; panels without a guard use the already authenticated host user.
- Panel email-verification and required-MFA enrollment gates.
- User channels: the authenticated primary key must match the channel user ID.
- Resource channels: a registered resource and its existing `viewAny` authorization.
- Tenant resource channels: membership returned by the panel tenancy adapter. Unscoped resource subscriptions on tenant panels are denied.

A configured policy without Bouncer denies subscription. Authorization errors fail closed. The adapter temporarily binds a minimal Pupitre request context for membership and policy checks, then restores the original context. Policies requiring a full resource-page request may need host integration; channel authorization does not grant record-level access. Reloaded HTTP responses still enforce normal resource, record and tenant checks. Arbitrary host middleware gates are not automatically reproduced by the adapter; apply the appropriate middleware to Transmit routes.

## Polling and deployment limits

Without a browser client or channel, configured table and notification polling is preserved. With both present, subscriptions replace polling; this is **not** automatic polling failover when an SSE connection fails. Configure and monitor your Transmit transport appropriately.

The example is single-process. Multi-process web/worker deployments need a shared Transmit transport such as Redis/MQTT for broadcasts to reach the connected process. The bridge does not implement a durable event log or replay missed pings.

Relation managers subscribe to and publish on their owning resource channel. Mutations through another resource do not automatically invalidate the owner's relation table, and relation-manager mutations do not invalidate a separately open related-resource index. Host mutations outside Pupitre can publish the same ping through the adapter when additional invalidation is needed. Never add sensitive record data to these events.
