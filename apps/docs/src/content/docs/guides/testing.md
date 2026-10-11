---
title: Testing
sidebar:
  order: 16
---

Test your application definitions at the controller boundary and your replacement components in a browser. Core helpers do not replace full routing/CSRF/browser verification.

## Japa helpers

`@rikology/pupitre/testing` exports `visitResource`, `submitForm`, `runAction`, `visitPage`, `assertSpecHas`, `assertVisible` and `assertHidden`.

```ts
import { visitResource, submitForm, assertSpecHas, assertVisible } from '@rikology/pupitre/testing'

const rendered = await visitResource('posts', 'create', { user, panel: 'admin' })
assertSpecHas(rendered.spec, { type: 'Text' })
assertVisible(rendered.spec, rendered.state, 'f.title')

const result = await submitForm('posts', 'create', { title: 'A post' }, { user })
result.assertOk()
```

Create a real authenticated model user and boot your test application with the Pupitre provider, Lucid and Bouncer first. Helpers build a test HTTP context and execute actual controllers, including policies, tenant scope, validation and hooks.

| Helper | Signature |
| --- | --- |
| `visitResource` | `(slug, 'list' | 'create' | 'edit' | 'view', options)` returns page/spec/state/data |
| `submitForm` | `(slug, 'create' | 'edit', data, options)` returns status/errors/record plus assertOk/assertErrors |
| `runAction` | `(slug, name, options)`; options may contain record, ids and data |
| `visitPage` | `(slug, options)` for custom pages |
| `assertSpecHas` | `(spec, { type, name?, props? })` matches type and optional prop subset |
| `assertVisible`, `assertHidden` | `(spec, state, elementName)` evaluates compiled visibility |

Options require `user`; optional `app`, `tenant`, `panel`, `query`, `record` set context. Panel defaults to admin. Edit submission requires a record (model instance or ID). Action 403 throws; 422 returns errors. `assertErrors({ title: 'required' })` matches case-insensitive substrings in field messages.

Inspect compiled element names rather than assuming a model attribute is always the element ID in nested layouts/repeaters. Deferred props may still need resolution in integration assertions.

## Playwright helpers

```ts
import { pupitreTest as test, expect } from '@rikology/pupitre-ui/testing'

test.use({ pupitre: { panelPath: '/admin', email: 'staff@example.com', password: 'test-password' } })

test('creates a post', async ({ admin, page }) => {
  await admin.login()
  await admin.gotoResource('posts', '/create')
  await admin.fillField('Title', 'A new post')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page).toHaveURL(/posts/)
})
```

The fixture supplies `AdminPage`: login, gotoResource, fillField, field, selectOption, openAction, submitModal, expectToast, row and table. Configure `basePath` for URL tenancy and `landingPath` when login should wait for a non-default destination. The helpers use accessible labels/roles and support both native and searchable selects.

Use isolated test databases. Cover allowed/denied policies, cross-tenant IDs, 422 errors, hooks, relation ownership, uploads, action modal transport and queue identity reload. Freeze time for timezone tests, with both UTC and a DST zone. Avoid snapshotting incidental HTML; compiled spec snapshots and schema validation assert the actual wire contract.
