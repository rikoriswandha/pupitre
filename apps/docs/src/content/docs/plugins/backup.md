---
title: "Backup: database snapshots"
description: "Configure private database snapshots, retention and authorized downloads with the official Backup plugin."
sidebar:
  label: "Backup"
---

Backup adds a protected resource for creating and managing database snapshots. Its downloads are private, and access should be limited to trusted system administrators.

Install `@rikology/pupitre-backup`, run `node ace add @rikology/pupitre-backup`, and apply `node ace migration:run`. The configure hook publishes `pupitre_backups` and registers the Ace command loader.

```ts
import { backup } from '@rikology/pupitre-backup'
import { definePanel, t } from '@rikology/pupitre'

export default definePanel('admin').plugins([
  backup({
    disk: 'private',
    directory: 'database-backups',
    keep: { last: 5, days: 30 },
    navigationGroup: t('Administration'),
    authorize: (ctx, ability, record) => ctx.pupitre.authUser?.email === 'admin@example.com',
    // connection: 'postgres',
    // binaries: { pgDump: '/usr/local/bin/pg_dump', mysqldump: '/usr/local/bin/mysqldump' },
  }),
])
```

Configure a private Drive disk without a public file-serving route. The Backups resource lists compressed size, status, age, and sanitized errors. Its header action creates a snapshot; completed rows offer an authorized streamed download and file-removing deletion. No public or signed storage URLs are emitted.

## Security and tenancy

**Backups contain the whole database, including other tenants.** Grant access only to trusted system administrators. Tenant metadata is scoped on HTTP reads and downloads, but this plugin is not a tenant export tool. The example app explicitly restricts it to the seeded administrator.

The callback receives `(ctx, ability, record?)`, with `viewAny`, `create`, `view`, and `delete`. Without a callback, a configured `BackupPolicy` must implement the corresponding methods; without either, access is denied. Downloads authorize `viewAny` before a scoped lookup, then authorize `view` for the record. Pending/running records cannot be deleted. The host must retain the standard request container bindings middleware.

## Scheduling and workers

```sh
node ace backup:run
node ace backup:run --connection=postgres --panel=admin
```

Schedule this command with cron or the host's scheduler. `runBackup(options, connection?)` is the trusted programmatic equivalent; authorize callers yourself outside HTTP.

The panel action uses the configured Pupitre jobs adapter when available, otherwise it runs synchronously. The plugin registers its worker handler during boot. A durable unique lock is reserved before dispatch and held through retention, preventing overlaps even across processes and connections. Concurrent create requests receive HTTP 409. Use a worker for large snapshots.

After a worker/process crash, verify that no backup is running before marking the stale row failed and clearing `active_lock`; remove abandoned temporary files or partial uploads. Automatic lock expiry is deliberately avoided because it could overlap a still-running dump.

## Database support and retention

- **SQLite:** `VACUUM INTO` creates a consistent standalone snapshot, including committed WAL contents. Do not invoke it inside an existing SQLite transaction.
- **PostgreSQL:** `pg_dump --format=custom` via `execFile`; credentials remain in `PGPASSWORD`. Connection objects and URLs are supported. Match client/server versions.
- **MySQL:** `mysqldump --single-transaction --quick` via `execFile`; credentials remain in `MYSQL_PWD`. Consistency requires transactional tables (InnoDB) and no concurrent schema changes.

No shell is invoked. Child-process output and credentials are never persisted or logged as errors. Dumps are gzip-streamed to private Drive storage; compressed bytes are counted without buffering the archive, and temporary directories are removed in ordinary success/failure paths. Infrastructure encryption and access controls remain the host's responsibility.

`keep.last` and `keep.days` are positive integers. Retention applies only after success and is scoped to disk, directory, connection, and tenant metadata. With both rules, a completed backup outside either rule is removed, while the fresh successful snapshot is preserved. Failed records are retained for diagnosis.

## Why restoration is manual

A browser restore would overwrite active application state, require downtime and connection shutdown, and expose infrastructure-level privileges through a web session. There is intentionally no restore endpoint. Test restoration to a separate database regularly:

```sh
# Stop SQLite writers; inspect a fresh copy before replacing any live database.
gunzip -c backup.gz > restored.sqlite
sqlite3 restored.sqlite 'PRAGMA integrity_check;'

# Restore PostgreSQL into an empty, isolated target.
gunzip -c backup.gz > restored.dump
pg_restore --dbname=restore_test --no-owner restored.dump

# Inspect MySQL database-selection statements before loading an isolated server.
gunzip -c backup.gz > restored.sql
mysql < restored.sql
```

MySQL archives include database selection statements from `--databases`; review those before restoring. Never load an unreviewed archive into production.
