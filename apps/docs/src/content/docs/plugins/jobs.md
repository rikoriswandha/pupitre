---
title: Jobs monitor
description: Monitor AdonisJS Queue jobs, inspect failures and safely retry registered jobs.
---

`@rikology/pupitre-jobs` adds an operational Jobs resource to your panel. It is server-only and uses the existing table, infolist and stats components.

## Setup

Install the plugin with `@adonisjs/queue` and configure the queue provider and adapters first. Then publish the monitor migration and command:

```sh
node ace configure @rikology/pupitre-jobs
node ace migration:run
```

```ts
import { jobs } from '@rikology/pupitre-jobs'

export default definePanel('admin').plugins([
  jobs({
    navigationGroup: 'Operations',
    retentionDays: 7,
    authorize: (ctx, ability, record) => ctx.auth.user?.isAdmin === true,
    allowRetry: (_ctx, record) => record.name === 'SendInvoiceJob',
  }),
])
```

Access is **denied by default**. Supply `authorize`, or register a host `JobRunPolicy` in the core `config.policies` loader. The callback takes precedence; otherwise Bouncer evaluates the host policy's `viewAny`, `view`, `retry`, `delete` and `prune` methods. Missing policies or methods deny access. Retry requires both authorization and an explicit allow-list through `allowRetry`. Do not allow arbitrary jobs with external side effects unless their handlers are safe to execute again.

## What is captured

The queue's supported public tracing channels observe every host job, not just Pupitre jobs. Sync and worker execution emit the same lifecycle messages. No opt-in job base class is needed. The plugin captures queued/running/completed/failed/retrying statuses, with separate rows for successive attempts.

The monitor shows status tabs, name search, payload/error details, a last-24-hour stats header (runs, failures, average duration), retry, delete and prune actions.

Payload credentials are recursively redacted by key name. Error messages/stacks also redact credential values from the payload, and their lengths are bounded. The original payload is stored separately using Adonis encryption and is never serialized to the browser. Manual retry decrypts that payload and checks the registered job name again; it never dispatches a redacted summary or imports a client-provided module path.

## Tenant boundaries

Host jobs should include a trusted `tenantId` in their payload. Pupitre's own action envelope is recognized automatically. Jobs without tenant metadata are global and invisible in tenant panels. Lists, details, stats and actions use the current tenant boundary; retry also checks it programmatically.

## Worker processes

Boot the plugin in every dispatcher/worker process. If a standalone queue worker does not boot your Pupitre panels, attach the same monitor manually:

```ts
import { monitorJobs } from '@rikology/pupitre-jobs'

const monitor = await monitorJobs({
  database: await app.container.make('lucid.db'),
  encrypt: (value) => encryption.encrypt(value),
  tenantId: (job) => job.payload.tenantId ?? null,
})
app.terminating(() => monitor.stop())
```

Attach listeners before dispatching or starting workers, and do not attach a second monitor in a process where the panel plugin already runs. Writes are serialized asynchronously because tracing subscribers cannot be awaited by the queue. `flushJobRuns()` waits for plugin writes when an immediate read is needed; manual monitors expose `flush()`. Shutdown drains pending writes. Abrupt process termination may lose pending monitor updates; the queue adapter remains the source of truth for job execution.

## Pruning

Schedule `node ace jobs:prune --days=7` daily. The command is an operator-level all-tenant operation. The resource action enforces `prune` authorization and only deletes old terminal runs in the current tenant. Running/queued/retrying rows are retained. `retentionDays` configures the resource action; the CLI's `--days` flag configures the command.

The example app includes **Run report job**, an ordinary host job generating a tenant-scoped post-status report, so you can try the complete lifecycle in the Jobs resource.
