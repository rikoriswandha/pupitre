---
title: Resources
sidebar:
  order: 2
---

`defineResource(Model)` binds a Lucid model to generated CRUD routes. Its default slug is the pluralized kebab-case model name, with a trailing `Model` removed. Override public URLs using `.slug()` rather than depending on class naming.

```ts
import { defineResource, pages, table } from '@rikology/pupitre'
import Post from '#models/post'

export default defineResource(Post)
  .slug('posts').label('Post').pluralLabel('Posts')
  .recordTitle('title')
  .navigation({ group: 'Content', sort: 10 })
  .globallySearchable(['title', 'author.name'])
  .globalSearchDetails((record) => [record.status])
  .form((s) => [s.text('title').required()])
  .table((t) => t.columns([table.text('title').searchable()]))
  .pages({ list: pages.list(), create: pages.create().redirectTo('edit'), edit: pages.edit(), view: pages.view() })
```

`form`, `table` and `infolist` callbacks describe UI, not request handlers. Form names are typed against model attributes. `.icon(string)` sets a navigation icon. `.actions({ header, row, bulk })` places [actions](/guides/actions/). `.policy(PolicyClass)` or `.policy(() => import(...))` selects authorization explicitly.

## Pages

Default pages are list/create/edit. `.pages({...})` replaces that map, so list every page you want to keep. `pages.list/create/edit/view()` return page builders supporting `.component(name)`, `.redirectTo('edit' | 'list' | 'view')`, `.widgets([...])` and `.footerWidgets([...])`. `pages.list().tabs({...})` adds scoped list tabs; tab definitions can include a query modifier, icon and badge. `.modals()` on the list page uses create/edit action forms instead of separate create/edit routes.

Adding `.infolist()` automatically adds a view page if none exists. Record pages expose sub-navigation to edit/view, relation tabs and nested resources.

## Persistence hooks

| Hook | Signature / use |
| --- | --- |
| `fill(record, ctx)` | Return form data for editing |
| `mutateBeforeCreate(data, ctx, trx)` | Transform create input before persistence |
| `mutateBeforeSave(data, record, ctx, trx)` | Transform update input |
| `beforeCreate`, `afterCreate` | Create lifecycle |
| `beforeSave`, `afterSave` | Update lifecycle |
| `beforeDelete`, `afterDelete` | Delete lifecycle |
| `create(callback)`, `update(callback)` | Replace default persistence handlers |

Callbacks may be asynchronous where their type allows it. See the [exact hook types](/reference/api-resource/) for callback parameters, especially the transaction argument on custom persistence handlers. Use the supplied transaction rather than opening unrelated transactions or writing outside it.

`.scope((query, ctx) => ...)` applies an application query restriction. `.scope(false)` opts a global resource out of automatic tenant scoping; it does not remove policy checks. Do not use it for tenant-owned data.

## Nested resources

Register a child with parent `.nested([ChildResource])` and child `.parent(ParentModelOrResource, 'relationName')`. Routes include the parent record ID, queries are parent-scoped, create fills ownership, and breadcrumbs include the parent. A client-supplied foreign key is not a substitute for the server's parent scope.

## Relation managers

```ts
import { defineRelationManager, table, actions } from '@rikology/pupitre'
import Post from '#models/post'

export const Comments = defineRelationManager(Post, 'comments')
  .label('Comments')
  .form((s) => [s.textarea('body').required()])
  .table((t) => t.columns([table.text('body')]))
  .actions({ header: [actions.create()], row: [actions.edit(), actions.delete()] })
```

Register with resource `.relations([Comments])`; `relationGroup(label, [...])` groups managers. Managers support icon, badge `(ctx, record)`, read-only mode and record title. Their tables load as deferred data on edit/view pages. Use attach/detach for many-to-many and associate/dissociate for appropriate relationships. Related-model policy and parent access are checked on the server.

## Soft deletes and global search

`.softDeletes()` defaults to model attribute `deletedAt`; pass a different attribute if needed. Add `table.filter.trashed()` and restore/force-delete actions. Queries remain tenant/parent-scoped, including restore and force deletion.

`.globallySearchable([...])` opts the resource into panel global search, including supported dotted relation fields. `.globalSearchDetails(record => string[])` supplies detail lines. Search filters resources and records through policies and chooses view/update destinations based on allowed abilities. Add indexes on searchable columns; `pupitre:inspect` reports missing indexes.
