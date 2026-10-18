---
title: "Saved table views"
description: "Configure developer table presets and personal or public saved views with scoped persistence and authorization."
sidebar:
  label: "Saved views"
---

Saved views let operators return to a useful table configuration without rebuilding its filters. Combine developer presets with authorized personal and public views.

Enable `.savedViews()` on a resource or relation-manager table and run the generated `1791700000044_create_pupitre_table_views` migration. Developer presets use `tableView('Drafts').query({ filters: { status: 'draft' } }).icon('file-pen').default()`. Every factory method returns a new builder.

The Views control groups preset, public and personal views. Apply replaces only that table's URL state and its visible-column preference. Save current view captures the server-normalized table query, not unsubmitted deferred-filter edits. Updating replaces a selected view's state; renaming keeps its state. Deletion requires confirmation. Users can set or unset a default and authorized users can publish or privatize their own views.

## Authorization and isolation

All operations authorize the table's `viewAny`. Relation managers also resolve the parent through the scoped resource query and authorize `view` before accessing views. Views are isolated by panel, tenant, table and owner. Public visibility does not grant permission to edit another user's view. The resource policy must explicitly implement `managePublicViews(user)` for publishing, updating a public view, privatizing it or deleting it. There is no fallback to create, update or an absent policy.

An owner's default takes precedence over a developer preset default, and applies only when there are no table query parameters. Explicit search, sort, filters, pagination, grouping, tab or selected-view state always takes priority. Relation-manager view URLs preserve other tables' state using their query prefix.

## HTTP contract

Resource endpoints are `GET|POST /<resource>/views` and `PUT|DELETE /<resource>/views/:view`. Relation endpoints append `/views` to `/<resource>/:id/relations/<relation>`. They use normal authenticated tenant panel middleware and CSRF protection.

POST and PUT accept:

```json
{
  "name": "My drafts",
  "query": { "filters": { "status": "draft" }, "sort": "-createdAt", "perPage": 25 },
  "columns": { "createdAt": true, "notes": false },
  "isPublic": false,
  "isDefault": true
}
```

`query` allows only `q`, `sort`, `filters`, `groupBy`, `perPage`, `tab` and individual searches under `columns.<name>.search`. Unknown fields, unavailable filter options, non-sortable columns and invalid visibility keys return 422. Pages are not saved. Names are required and limited to 120 characters. Unknown or foreign view identifiers return 404. Unauthorized public mutations return 403. DELETE returns 204; other successful operations return JSON view descriptors.

## Client contract

The table descriptor's optional `views` contains the endpoint URL, enabled flag, public-management permission and view items. `useTableViews(descriptor, onColumns)` returns the current items, active item, `apply`, `mutate`, busy state and localized error. The visual implementation is `DataTableViews` in pupitre-ui. Column visibility normally stays in localStorage; a saved view explicitly carries it so its configuration can be applied consistently in another browser.

Saved views are not supported on custom-data table widgets.
