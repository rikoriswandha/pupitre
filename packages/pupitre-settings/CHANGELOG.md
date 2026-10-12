# @rikology/pupitre-settings

## Unreleased

- Add immutable typed settings groups, generated custom pages and optional page actions.
- Every writable form field must have a `.defaults()` entry; missing defaults fail at plugin registration.
- Persist JSON values with merged defaults, shared VineJS validation and atomic transactions.
- Add fail-closed group authorization, tenant isolation and request-scoped caching.
- Publish an idempotent SQLite/PostgreSQL migration through the configure hook.
