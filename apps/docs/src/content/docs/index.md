---
title: Admin panels, expressed in TypeScript.
description: Pupitre brings declarative admin panels to AdonisJS v7 and Inertia React.
template: splash
hero:
  title: Your models. Your admin. Your code.
  tagline: Build an AdonisJS admin panel with typed resources, reactive forms and server-authorized actions. Keep the React components yours.
  actions:
    - text: Get started
      link: /getting-started/
      icon: right-arrow
    - text: Coming from Filament?
      link: /migrating-from-filament/
      variant: secondary
---

## Less plumbing. More application.

Pupitre turns Lucid models and immutable TypeScript builders into an Inertia React admin panel. Describe the form and table once; Pupitre handles the routes, validation, scoped queries and action transport.

```ts
import { defineResource, table } from '@rikology/pupitre'
import Post from '#models/post'

export default defineResource(Post)
  .recordTitle('title')
  .form((s) => [
    s.text('title').required().maxLength(200),
    s.select('status').options({ draft: 'Draft', published: 'Published' }),
  ])
  .table((t) => t.columns([
    table.text('title').searchable().sortable(),
    table.badge('status'),
  ]))
```

**Adonis-native.** Lucid persistence, VineJS validation, Bouncer policies and your application's session guard.

**React, not remote JavaScript.** Declarative specs power forms and tables. Simple reactive closures become safe expressions, not executable source sent to the browser.

**Yours to change.** Replace a registry component without forking the backend. Add behavior through panel plugins and optional adapters.

Start with [your first panel](/getting-started/), explore the [form components](/guides/forms/), or compare the [Filament API equivalents](/migrating-from-filament/).
