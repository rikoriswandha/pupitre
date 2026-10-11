---
title: Panels
sidebar:
  order: 1
---

A panel is an independently routed admin surface. `definePanel(id)` defaults to `/<id>` and returns an immutable builder: keep the returned value from every chain. You can create multiple panel modules for different domains, guards or audiences.

```ts
import { definePanel, nav } from '@rikology/pupitre'

export default definePanel('staff')
  .path('/staff')
  .domain('staff.example.com')
  .guard('web')
  .brand({ name: 'Operations' })
  .timezone('Asia/Jakarta')
  .navigation([nav.group('Content').items(['posts'])])
  .notifications({ interval: 30_000 })
  .globalSearch({ keyBinding: 'mod+k' })
```

## Complete builder surface

| Method | Purpose |
| --- | --- |
| `path(string)`, `domain(string)` | URL prefix and optional host restriction |
| `guard(string)` | Host authentication guard |
| `middleware(array)` | Panel middleware, in declaration order |
| `resources(arrayOrRecord)`, `pages(arrayOrRecord)` | Register definitions/builders or discovered modules |
| `brand(object)` | Name, logos and favicon; exact fields in [panel reference](/reference/api-panel/) |
| `theme(object)` | Validated [theme](/guides/theming/) |
| `timezone(string)` | Panel display/parse timezone |
| `locale('en')` | English, the supported locale |
| `breadcrumbs(boolean)` | Disable or enable generated breadcrumbs |
| `login(enabled?)`, `registration(enabled?)` | Built-in sign-in and sign-up |
| `passwordReset(enabled?)`, `emailVerification(enabled?)` | Mail-backed reset/verification |
| `mfa({ required?, issuer? } | false)` | TOTP and recovery-code support |
| `passkeys(enabled?)` | WebAuthn login/profile management |
| `profile(boolean | { avatar? })` | Profile page and avatar controls |
| `social(string[] | { providers, registration? })` | Ally provider login |
| `navigation(entries)` | Explicit `nav.group()` / `nav.item()` tree |
| `userMenu(items)` | Host-defined account menu links/actions |
| `tenancy(options | false)` | Membership-aware URL/implicit tenant context |
| `notifications({ interval? } | false)` | Notification tray; interval is milliseconds |
| `globalSearch({ keyBinding? } | false)` | Search UI; enabled by default with `mod+k` |
| `widgets(arrayOrRecord)` | Dashboard widgets |
| `filters(definitions)` | Dashboard filter definitions |
| `plugins(plugin[])` | Ordered plugin list; repeated calls replace the list |
| `toDefinition()`, `toJSON()` | Inspect the definition or deterministic serialized representation |

Auth methods that take an optional boolean enable their feature when called without arguments. Built-in auth is disabled initially. Notifications are disabled initially; global search is enabled but only resources declaring searchable fields participate.

## Navigation and menus

Without explicit navigation, resources and pages contribute their metadata. Resource `.navigation({ group, sort, badge })` and page `.navigation(...)` control placement; badges are server callbacks. Bouncer `viewAny`, page `canAccess`, and visibility checks filter entries. Nested resources do not get top-level navigation entries.

Use `nav.group(label).items([...])` for ordered groups and `nav.item(label)` for host links. The [generated navigation reference](/reference/api-panel/) lists exact link, icon, sort, visibility and collapsibility signatures. `userMenu()` items support server visibility, sorting, methods and external destinations.

Plugins append their navigation contributions after host contributions; equal group labels merge. See [plugin ordering](/plugins/) before combining explicit and derived navigation.
