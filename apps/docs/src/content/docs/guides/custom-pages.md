---
title: Custom pages
sidebar:
  order: 8
---

Use a custom page when the workflow is not a model's CRUD lifecycle. Put its module in `app/admin/pages/*_page.ts`, or register it directly on the panel.

```ts
import { definePage } from '@rikology/pupitre'

export default definePage('preferences')
  .path('/preferences').title('Preferences').icon('settings')
  .canAccess((ctx) => Boolean(ctx.auth.user))
  .form((s) => [s.text('fullName').required()])
  .fill((ctx) => ({ fullName: ctx.auth.user!.fullName }))
  .save(async ({ data, ctx }) => {
    ctx.auth.user!.merge({ fullName: String(data.fullName) })
    await ctx.auth.user!.save()
  })
```

Adapt the user attributes and access predicate to your host model and policy. A page access check protects page form/options/upload boundaries too. `.navigation({...})` controls menu group/sort/badge; `.actions([...])` adds header actions. `.component('HostPage')` selects a host registry component for a completely custom UI.

`.widgets([...])` and `.filters([...])` make custom dashboards using the same widget grid as the panel. The default path is `/<slug>`, mounted under the panel's path (and tenant path when applicable). `.title()` overrides the title inferred from the slug. See [CustomPageDefinition](/reference/api-page-widget/) for exact fill/save callback signatures.

Generate a page with `node ace make:page Preferences`. The generator preserves existing files unless `--force` is passed; the assembler hook discovers modules by their page suffix.
