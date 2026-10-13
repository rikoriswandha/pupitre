# Changelog

## Unreleased

- Add server-only Backups resource with fail-closed authorization, tenant-scoped metadata, private streamed downloads, and file-removing deletion.
- Add consistent SQLite, PostgreSQL custom-format, and transactional MySQL snapshots, gzip-streamed to Drive with credential-safe errors and guaranteed ordinary-path temporary cleanup.
- Add durable cross-process concurrency exclusion, post-success count/age retention, optional jobs dispatch, and schedulable `backup:run` command.
- Document administrator-only access and manual restoration procedures; no web restoration endpoint is exposed.
