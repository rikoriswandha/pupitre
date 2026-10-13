# @rikology/pupitre-backup

Private, consistent database snapshots for Pupitre panels. Server-only; the existing resource renderer supplies the Backups table, create action, download link, and delete confirmation.

## Installation

```sh
npm install @rikology/pupitre-backup
node ace add @rikology/pupitre-backup
node ace migration:run
```

Register the plugin on a panel:

```ts
import { backup } from '@rikology/pupitre-backup'

backup({
  disk: 'private',
  directory: 'database-backups',
  connection: 'sqlite', // optional; defaults to Lucid's primary connection
  keep: { last: 5, days: 30 },
  navigationGroup: 'Administration',
  authorize: (ctx, ability, record) => ctx.pupitre.authUser?.email === 'admin@example.com',
  binaries: { pgDump: '/usr/local/bin/pg_dump', mysqldump: '/usr/local/bin/mysqldump' },
})
```

The Drive disk must be private and must not expose a static file-serving route. Backups never call `getUrl` or `getSignedUrl`; authenticated, authorized downloads stream through the panel. Delete removes storage before deleting the metadata row. Missing files return 404; unfinished files cannot be downloaded or deleted.

The authenticated download route is named `<panel-id>.backups.download` (for example, `admin.backups.download`). Use that name with the host router URL builder and the backup's `id`; URL-tenant panels also require their tenant route parameter.

**A snapshot contains the entire selected database, not just one tenant.** Restrict authorization to trusted system/database administrators. Tenant metadata and HTTP record queries are isolated, but this is not a tenant-data export feature. The example uses a private local disk and an explicit administrator-only callback.

## Authorization

Without `authorize` or a configured `BackupPolicy`, access is denied. The callback receives `(ctx, ability, record?)`; supported abilities are `viewAny`, `create`, `view` (download), and `delete`. A host policy must implement those same abilities. Resource authorization happens before lookup and record authorization happens afterwards. Metadata belonging to a different tenant is not downloadable even when the callback allows it. Host middleware must bind `HttpContext` to the request container, as in the standard Adonis starter.

## Execution and scheduling

```sh
node ace backup:run
node ace backup:run --connection=postgres --panel=admin
```

The configure hook registers the command loader. Schedule the command using your host scheduler or cron. Commands are trusted server operations and do not simulate an HTTP user. `runBackup(options, connection?)` offers the same trusted server API.

The panel action dispatches through `config.pupitre.jobs` if configured. Plugin boot registers the handler with that adapter. The durable lock is reserved before dispatch, so queued backups also prevent a second request. Without a jobs adapter the request performs the snapshot synchronously. Use a worker and a jobs adapter for large databases. A unique nullable `active_lock` column enforces one backup across processes and connections; concurrent creation returns HTTP 409.

SQLite uses `VACUUM INTO` to create a consistent standalone copy, including WAL-backed databases. PostgreSQL runs `pg_dump --format=custom`; MySQL runs `mysqldump --single-transaction --quick` (transactional tables only; avoid concurrent schema changes and use InnoDB). Processes use `execFile`, never a shell. Passwords are passed only in `PGPASSWORD`/`MYSQL_PWD`; no credentials or child-process output enter stored errors. PostgreSQL connection URLs and object configurations are supported. Match dump binary versions to your database server. The dump is gzip-streamed to Drive, counting compressed bytes without buffering the archive. Temporary directories are removed on success and failure.

Rows transition `pending → running → completed|failed`. Retention runs only after a successful upload, scoped to disk/directory/connection/tenant. When both rules are supplied, a completed backup outside either rule is removed; the new successful snapshot is always preserved. Failed backups are retained for diagnosis. Backups must not run inside an existing SQLite transaction.

A process killed by the OS cannot execute cleanup. If a worker crashes, inspect pending/running records, confirm no backup process is active, remove any abandoned temporary directories/partial files, then mark the affected row failed and clear `active_lock`. Do not clear the lock while a dump is running. The plugin deliberately does not expire locks automatically, which could permit two large snapshots to overlap.

## Manual restore (no web restore)

Restoration is intentionally outside the plugin: it can overwrite live data, requires downtime/connection shutdown, and may require infrastructure credentials outside the web application's privileges. Test restore procedures regularly on isolated databases.

```sh
# SQLite: stop writers, decompress to a fresh path, inspect it, then replace the database.
gunzip -c backup.gz > restored.sqlite
sqlite3 restored.sqlite 'PRAGMA integrity_check;'

# PostgreSQL: create an empty target database, then restore the custom archive.
gunzip -c backup.gz > restored.dump
pg_restore --dbname=restore_test --no-owner restored.dump

# MySQL: inspect the SQL database names before loading into an isolated server.
gunzip -c backup.gz > restored.sql
mysql < restored.sql
```

MySQL `--databases` archives include database selection statements; rewrite them only as part of a reviewed restore process. Never run an unreviewed dump against production. Encrypt backups at the storage/infrastructure layer and retain them according to your data-protection policy.
