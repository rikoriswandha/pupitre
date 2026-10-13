---
title: Impersonation
description: Safely troubleshoot tenant accounts with administrator-initiated impersonation.
---

Enable impersonation on a session-authenticated panel with built-in `.login()` and add the record action to the resource backed by your configured authentication user model. Panels without built-in login are rejected at boot.

```ts
const panel = definePanel('admin').login().profile().impersonation()

const users = defineResource(User)
  .policy(UserPolicy)
  .actions({ row: [actions.view(), actions.impersonate()] })
```

The default authorization requires a resource policy with an explicit `impersonate(actor, target)` method. Missing policies and missing abilities deny access; there is no fallback to update or view. The default target restriction disallows impersonating yourself. Resource-level access is checked before the target is loaded through the resource's scoped query. The target must also belong to the current tenant, even when the Users resource uses `.scope(false)`.

With Shield, the default target restriction also prevents an actor with a delegated `users.impersonate` permission from assuming a super-admin identity. Only a super administrator may impersonate another super administrator. An explicit `canBeImpersonated` callback replaces this default restriction; ensure custom callbacks preserve your privilege boundaries.

```ts
class UserPolicy {
  impersonate(actor: User, target: User) {
    return actor.isAdmin && actor.id !== target.id
  }
}
```

## Panel options

```ts
panel.impersonation({
  canImpersonate: async (actor, ctx) => actor.isAdmin,
  canBeImpersonated: async (target, ctx) => !target.isAdmin,
  redirectTo: '/admin',
})
```

`canImpersonate` replaces the default policy check. `canBeImpersonated` replaces the default self restriction. Neither callback bypasses tenant membership or the requirement that the action resource use the authentication model. A model's `canAccessPanel(panel)` method, when present, must allow the target to access the panel. Nested impersonation is always rejected. Actions can be placed in row actions or record-page header actions; bulk impersonation is not supported.

## Sessions and MFA

Pupitre stores the original actor ID, target ID, panel ID, guard, and a same-origin return path in the session. Starting and leaving impersonation both regenerate the session ID. The actor must have completed their own enabled MFA challenge. The target is deliberately not challenged: this is an administrator-authorized troubleshooting session, not a credential-based login by the target, and requesting the target's second factor would defeat that workflow.

The shell displays **You are signed in as {name}** with a **Leave** button. Leaving submits a CSRF-protected POST to `/impersonation/leave` under the panel's base path and reloads the actor from the database before restoring the original guard. If the actor was deleted, Pupitre clears the session and logs out instead. Redirects accept only same-origin relative paths.

Profile mutation endpoints and the locale preference endpoint are blocked with HTTP 403 and an error flash during impersonation, including password, MFA, passkeys and browser-session revocation. Leave impersonation before making account changes.

## Events and login history

Pupitre emits `pupitre:impersonation:started` and `pupitre:impersonation:stopped`, each containing `{ actorId, targetId, panelId }`. When browser-session tracking is enabled, start and stop are also recorded as authentication events for the actor. Session tracking continues to validate the original actor session rather than recording or revoking a target session.
