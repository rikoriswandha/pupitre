# Changelog

## Unreleased

- Localize role and permission management labels and user-facing errors.

## 0.1.0 — Milestone M4

- Add Lucid Role and Permission models, global role-management resource with resource-grouped permission checkboxes, and configurable host user relation/table integration.
- Add request/user-cached Bouncer policies, explicit-policy preservation, independent standard ability checks, custom action abilities, nested-resource discovery, and super-admin bypass.
- Add `shieldCan` page authorization and `shieldRolesField` User-resource relationship helper.
- Add configure migration publishing and lazy Ace command registration; `shield:sync` idempotently synchronizes resource permissions and can bootstrap a super administrator by ID/email.
- Add SQLite HTTP integration coverage and seeded example editor/super-admin integration.
- Security (WP42): forbid non-super-admin escalation through role names or permission delegation, protect the reserved role, and invalidate request-cached grants after edits; expose `invalidateShieldPermissions()` for host-managed pivot changes.
- Persist `shieldRolesField()` assignments and revocations transactionally with authenticated delegation checks, preserving host hooks and invalidating grants after pivot synchronization.
- Cover Shield-protected production queued workers, permission revocation, changed principals, cross-tenant records and revoked memberships.
- Thread active transactions through permission checks, isolate request caches from transaction snapshots, and authorize both permission additions and removals while preserving unchanged grants.
- Restrict Roles form inventories to enforced resources, discover relation-manager abilities on related resources, and isolate inventories when a plugin instance is reused across panels.
- Hide unauthorized role-assignment fields without blocking User forms or preloading forbidden options; preload existing role selections on edit.
- Reject deletion of roles containing any resource or host permission the actor lacks, while retaining super-admin bypass and deletion of fully delegated roles.
- Validate role-assignment IDs as positive PostgreSQL-range integers before querying Roles; normalize equivalent numeric IDs and cover create/update rejection with query-spy regressions.
