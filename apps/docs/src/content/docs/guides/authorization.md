---
title: Authorization
sidebar:
  order: 9
---

Pupitre maps resource access to Bouncer policies. Use `.policy(PostPolicy)` or a lazy policy import; otherwise `config.pupitre.policies` resolves `<Model>Policy` (or the model-name key). Install/register Bouncer middleware as part of your host application.

**No policy means allow, with a warning.** A present policy that lacks an ability denies it unless the documented fallback applies. Audit every resource before deployment using `pupitre:inspect`.

## Ability mapping

| Operation | Policy method | Fallback if method absent |
| --- | --- | --- |
| List / navigation / resource search | `viewAny(user)` | None |
| View record | `view(user, record)` | None |
| Create | `create(user)` | None |
| Edit / inline edit | `update(user, record)` | None |
| Delete | `delete(user, record)` | None |
| Restore | `restore(user, record)` | None |
| Force delete | `forceDelete(user, record)` | None |
| Replicate | `replicate(user, record)` | `create` |
| Reorder | `reorder` | `update` |
| Attach | `attach` | `create` |
| Detach | `detach` | `delete` |
| Associate | `associate` | `update` |
| Dissociate | `dissociate` | `update` |
| Custom resource action `.can('publish')` | `publish` | None |

The fallback changes the method name, not the authorization requirement. Define dedicated relation/reorder methods when the generic fallback is too permissive. Related-model options and managers also resolve policies. Pages use `.canAccess(ctx)`, widgets `.canView(ctx)`, and host abilities may be checked through Bouncer for actions outside a resource.

## Server boundaries

Visibility is not security. Every record lookup, action GET/POST, upload, options query, inline edit and server watch must retain scoped lookup and authorization. Bulk and queued actions reload selected IDs through the active resource scope rather than trusting selection payloads. Test both denied access and cross-tenant records.

Role/permission storage is a separate plugin concern. The core policy mapping works without Shield; when migrating from Filament Shield, use Bouncer policies rather than assuming Laravel permissions or PHP policy classes are compatible. [Writing plugins](/plugins/) explains how a plugin can extend resource policies without replacing model/slug identity.
