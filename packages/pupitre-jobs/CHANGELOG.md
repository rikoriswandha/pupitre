# @rikology/pupitre-jobs

## Unreleased

- Bound the optional `@adonisjs/queue` peer to `~0.6.2`, matching `@rikology/pupitre`. The previous `>=0.6.0` range accepted future breaking releases of the experimental queue package.

## 1.0.0 (2026-10-13)

- Monitor all AdonisJS Queue jobs through supported lifecycle tracing channels, preserving each execution attempt.
- Add tenant-scoped Jobs lists, status tabs, payload/error details and 24-hour stats.
- Encrypt original retry payloads, recursively redact credentials, and fail closed on authorization and retry eligibility.
- Add terminal-run retention pruning, an Ace command, migration publishing and a runnable host-job example.
