# @rikology/pupitre-transmit

Authenticated realtime pings for Pupitre, using AdonisJS Transmit (SSE). Install `@adonisjs/transmit` on the server and the optional `@adonisjs/transmit-client` browser peer. Register the Transmit provider/config and `transmit.registerRoutes()` with your session/auth middleware, as in `apps/example`.

```ts
import { transmitRealtime } from '@rikology/pupitre-transmit'
// config/pupitre.ts
export default defineConfig({ realtime: transmitRealtime(), /* your other settings */ })
```

```tsx
import { transmitRealtimeClient } from '@rikology/pupitre-transmit/client'
const realtime = transmitRealtimeClient()
// Reuse the instance; creating it performs no browser I/O (SSR-safe).
<Pupitre registry={registry} realtime={realtime} />
```

The browser factory accepts the Transmit constructor options (including `baseUrl`, `uidGenerator`, event-source factory and request hooks). It automatically copies the `XSRF-TOKEN` cookie into `X-XSRF-TOKEN` for subscribe **and unsubscribe** requests. Shield decrypts that header when `csrf.enableXsrfCookie` is enabled; keep CSRF enabled and use that setting for protected Transmit routes. Custom `beforeSubscribe`/`beforeUnsubscribe` hooks run afterward and can add headers. It multiplexes same-channel listeners, validates ping payloads with the catalog schema, and removes subscriptions when the last listener leaves.

Channels are `pupitre/<panel>/users/<user>` and `pupitre/<panel>[/tenants/<tenant>]/resources/<resource>` (URI-encoded segments). User channels require the configured panel guard and matching authenticated primary key. Resource channels require that guard, a registered resource, tenant membership from the panel tenancy adapter when applicable, and the existing resource `viewAny` Bouncer policy. Missing Bouncer for a configured policy denies subscription. Untenant-scoped subscriptions on tenant panels are denied. The adapter binds/restores a minimal Pupitre context on the Transmit request for membership/policy checks; policy dependencies requiring a complete resource request are not available, and authorization errors fail closed. Host resource responses remain the source of truth and repeat their normal authorization.
For panels delegating login to host middleware (no panel guard), the existing authenticated host user is used instead. When a panel specifies a guard, the adapter authenticates through that guard on the Authenticator itself so the Bouncer subject matches the channel principal.
Panel email-verification and required-MFA enrollment gates are also enforced before either channel is authorized. Realtime relation managers subscribe to their owning resource, not every related model's resource: mutations through another resource do not automatically invalidate that owner's relation table. Host mutations outside Pupitre can publish the same ping through the adapter when they need to invalidate a panel list.
Conversely, mutations performed through a relation manager ping the owning resource only; they do not invalidate a separately-open related resource index. If the host exposes both editing surfaces, it can explicitly publish an additional related-resource ping.

Events contain no record or notification content: `{ type: 'pupitre:table', resource }` or `{ type: 'pupitre:notification' }` (no legacy aliases). Inbox pings reach every panel with notifications enabled. Pupitre reloads authorized data; without a client, polling remains the fallback. Transmit reuses core `panelGuard` and `realtimeChannels.patterns` for authorization. Configure Redis/MQTT transport for multiple web/worker processes rather than relying on the example's single process.

`transmitRealtime({ service })` accepts a compatible Transmit service for isolated tests. Server route registration remains the host application's responsibility.
