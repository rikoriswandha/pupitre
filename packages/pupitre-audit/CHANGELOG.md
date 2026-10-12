# Changelog

## Unreleased

- Localize Activity navigation, fields and timeline headings.
- Keep historical audit entries visible without subject links when PostgreSQL cannot parse their IDs as the subject model's primary-key type.

## 0.1.0

- Add record activity timelines backed by the configured Pupitre audit adapter.
- Add a read-only Activity resource with event, subject, and date-range filters, old/new detail, and authorized subject links.
- Require explicit authorization or AuditPolicy/ActivityPolicy for activity access.
- Security (WP42): add regression coverage for Activity tenant isolation and subject links requiring scoped records and list/detail authorization.
- M4 review: use the supported `activity` icon and clarify that custom audit adapters provide timelines, not Activity resource queries.
