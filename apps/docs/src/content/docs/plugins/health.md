---
title: "Health: infrastructure checks"
description: "Connect host infrastructure checks to an authorized health dashboard without exposing a public health endpoint."
sidebar:
  label: "Health"
---

Health shows authorized operators the results of infrastructure checks defined by the host application. The dashboard is a protected panel page, not a public status endpoint.

Install `@rikology/pupitre-health`, then run `node ace add @rikology/pupitre-health` to publish `start/health.ts`. The host owns the `HealthChecks` registry; the plugin has no public health endpoint and never persists results.

```ts
import { health } from '@rikology/pupitre-health'
import checks from '#start/health'

export default definePanel('admin').plugins([
  health({
    checks,
    cacheSeconds: 60,
    navigationGroup: 'Administration',
    authorize: (ctx) => ctx.auth.user?.isAdmin === true,
    page: { slug: 'health', label: 'Health', icon: 'activity' },
  }),
])
```

## Checks

AdonisJS exports `HealthChecks`, `DiskSpaceCheck`, `MemoryHeapCheck` and `MemoryRSSCheck` from `@adonisjs/core/health`. Lucid exports `DbCheck` and `DbConnectionCountCheck` from `@adonisjs/lucid/database`. Pass a Lucid connection to database checks. Connection-count checks require a supported database; omit them for SQLite.

The page displays overall status, counts for healthy/warning/error results, the last execution time, and a paginated results table. Status uses both an icon and a text badge. **Run checks** bypasses the plugin cache. Concurrent requests share one execution, including concurrent forced refreshes. The TTL starts when execution completes; a zero TTL disables retained results.

Do not use `.cacheFor()` on individual Adonis checks if a forced refresh must execute them immediately. Adonis maintains its own private per-check cache, separate from this plugin's TTL.

## Authorization and tenancy

Every page, action and widget read is protected before checks run. Supply `authorize(ctx)` or register `HealthPolicy` through Pupitre's `policies` configuration with a `view(user)` method. Missing policy, missing Bouncer, or a rejected callback denies access (403); navigation is hidden. Restrict infrastructure diagnostics to trusted operators, not merely any authenticated user. Host tenancy membership middleware still applies to tenant-scoped panel URLs. Cached results are process-level infrastructure diagnostics, not tenant data; do not put tenant-dependent checks in this shared registry.

## Safe metadata

Only finite numbers under known measurement keys (such as used, limit, total, available, free, active and thresholds) are retained. Known measurement groups (`memoryInBytes`, `sizeInPercentage`, `diskSpace`, `connections`) are filtered recursively. Database connection configuration, exception objects, arbitrary strings and unknown keys are never emitted. Check names and messages are host-controlled: custom checks must not put credentials into either. The plugin does not expose process debug information.

`HealthRunner` and `safeHealthMeta` are exported for trusted server-side use. Programmatic callers are responsible for authorization; the dashboard performs it automatically.
