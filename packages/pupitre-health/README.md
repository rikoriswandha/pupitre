# @rikology/pupitre-health

Server-only infrastructure health dashboard for Pupitre and AdonisJS v7.

```ts
import { health } from '@rikology/pupitre-health'
import checks from '#start/health'

panel.plugins([health({ checks, authorize: (ctx) => ctx.auth.user?.isAdmin === true })])
```

Run `node ace add @rikology/pupitre-health` to publish a host-owned disk, heap, RSS and database check registry. The page includes summary statistics, paginated check results with status icons/text, and a Run checks header action.

Options: `checks` (HealthChecks), `navigationGroup`, `authorize(ctx)`, `cacheSeconds` (default 60), and `page: { slug, label, icon }`. Without an explicit authorizer, host `HealthPolicy.view` is required; otherwise access fails closed. Checks are run only after authorization. Results are process-local and concurrent executions coalesce. Forced runs bypass the plugin TTL; omit Adonis `.cacheFor()` on individual checks when forced runs must execute checks immediately.

Metadata is restricted to known finite numeric measurements. Connection details, errors and unknown keys are discarded. Custom check names/messages must not contain secrets. Do not register tenant-dependent checks: this is a process-infrastructure report, with tenant membership still enforced by the panel.

Trusted server APIs: `HealthRunner.run(force?)`, `safeHealthMeta(meta)` and `authorizeHealth(ctx, options, config)`.

Full documentation: https://pupitre.dev/plugins/health
