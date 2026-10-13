# @rikology/pupitre-jobs

A server-only job monitor for Pupitre and AdonisJS Queue. It observes **all host jobs**, including Pupitre's `PupitreActionJob`, through the queue's public `tracingChannels` dispatch/execution channels. No job subclass or monkey patch is necessary.

## Installation

Install `@rikology/pupitre-jobs` and `@adonisjs/queue`, configure the queue provider, then run:

```sh
node ace configure @rikology/pupitre-jobs
node ace migration:run
```

Add the plugin to your panel:

```ts
import { jobs } from '@rikology/pupitre-jobs'

panel.plugins([
  jobs({
    navigationGroup: 'Operations',
    retentionDays: 7,
    authorize: (ctx, ability, run) => ctx.auth.user?.isAdmin === true,
    allowRetry: (_ctx, run) => run.name === 'SendInvoiceJob',
  }),
])
```

Access requires either `authorize` or a host `JobRunPolicy` registered by the core `config.policies` loader. The callback takes precedence; without it the plugin resolves `JobRunPolicy` (a policy class or a module's default export) through Bouncer. Missing policies or ability methods deny access (`viewAny`, `view`, `retry`, `delete`, `prune`). Retry also requires an explicit `allowRetry`, a failed run, a decryptable original payload and a job currently present in the queue's Locator. Eligibility is evaluated again on submission. A denied/unknown job has a disabled retry action; loading a JavaScript path supplied by a request is never supported.

## Recorded data

The Jobs resource has status tabs, name search, view details, deletion, pruning and a tenant-scoped last-24-hours stats widget. Every execution attempt has its own row: job identifier, registered name, queue, status, attempt, redacted payload, error/stack, UTC queue/start/end timestamps and duration. Retry attempts retain their `retrying` history rather than overwriting it.

Payload keys matching `password|secret|token|key|authorization|cookie` (case-insensitive, at every object/array depth) become `[REDACTED]`. Credential values found under those keys are removed from error text too. Error messages are limited to 2,000 characters and stacks to 8,000. The complete original payload is **encrypted with the host APP_KEY** and excluded from model serialization; redacted summaries are never used as retry input. Changing APP_KEY makes old runs non-retryable.

Tenant attribution defaults to `payload.tenantId`, or `payload.payload.tenantId` for Pupitre action envelopes. Jobs without that metadata are global and are not exposed in tenant panels. Never put a tenant supplied by an untrusted client into a job; use the authenticated tenant context. The advanced `monitorJobs({ database, encrypt, tenantId })` API lets non-Pupitre workers choose another trusted attribution rule.

## Worker lifecycle and durability

Queue tracing subscribers are synchronous, so database writes are serialized in an asynchronous persistence chain. The resource waits for that chain before reading; shutdown drains it. `await flushJobRuns()` gives host code an explicit read-after-dispatch boundary. A persistence failure is retained and surfaced when flushing rather than silently swallowed. This monitor is observability, not the queue's durable job source: an abrupt process kill can interrupt pending monitor writes.

The panel plugin must boot in each process that dispatches/executes jobs. Hosts with standalone workers that do not boot Pupitre can call `monitorJobs` during worker initialization and await `monitor.stop()` on shutdown. Register listeners before dispatch/worker startup. Do not register both the plugin and a manual monitor in the same process.

## Retention

```sh
node ace jobs:prune --days=7
```

Schedule this command daily. It removes only completed/failed runs older than the cutoff, never queued/running/retrying work. The console command is an operator-level, all-tenant operation. The resource's prune action applies `authorize('prune')` and the current tenant boundary. `pruneJobRuns(days, tenantId)` is available for custom schedulers; omit tenantId only for deliberate global administration.
