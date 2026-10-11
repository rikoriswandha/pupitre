---
title: Actions
sidebar:
  order: 6
---

`action('kebab-case-name')` creates a custom action. Assign it to resource header, row or bulk placement; that placement supplies its execution context.

```ts
import { action, schema } from '@rikology/pupitre'
import Post from '#models/post'

const publish = action('publish')
  .label('Publish').icon('check').color('success')
  .can('publish').requiresConfirmation()
  .modalHeading('Publish this post?')
  .form([schema.textarea('note').maxLength(500)])
  .handle(async ({ record, notify }) => {
    const post = record as Post
    post.merge({ status: 'published' })
    await post.save()
    notify?.success('Post published').send()
  })
```

Handle callbacks receive the typed [ActionHandleContext](/reference/api-action/) including optional HTTP/job context, record(s), validated data and notify controls. The `.after()` context adds redirect and table refresh controls. Keep external side effects intentional; authorizing a button in the UI is not sufficient. `.can('ability')` is checked on the server each time, and `.visible(callback)` controls presentation.

## Builder controls

Presentation: `.label()`, `.icon()`, `.color()`, `.variant('button' | 'link' | 'iconButton')`, `.group(name)`, `.keyBindings([...])`. Global shortcuts apply to header/form/section actions and selection-aware bulk actions, not each repeated row button.

Modal: `.requiresConfirmation()`, `.destructive()`, `.modalHeading()`, `.modalDescription()`, `.modalWidth()`, `.slideOver()`, `.modalSubmitLabel()`, `.modalCancelLabel()`, `.modalIcon()`, `.modal({...})`, `.modalSubmit(false)`, `.modalCancel(false)`. Pass `.modal({ footerActions: [...] })` to add footer actions using the current modal data. Wizards work inside action forms.

Execution: `.form([...])`, `.fillForm(callback)`, `.handle(callback)`, `.after(callback)`, `.url(stringOrCallback)`, `.openUrlInNewTab()`, `.deselectAfter()`, `.async()`, `.deepLinkable()`, `.rateLimit(maxAttempts, { per, by })`. `.excludeAttributes([...])` controls replication. Export columns and import record resolvers are restricted to the corresponding built-in action.

## Built-ins and bulk

`actions` includes create/edit/view/delete, restore/forceDelete/replicate, bulk, bulkRestore/bulkForceDelete, export/import, attach/detach/associate/dissociate, bulkDetach/bulkDissociate. Defaults supply action names; override them when registering multiple versions. Generic bulk actions are `actions.bulk('name').handle(...)` and receive selected records, not one row. Use `.deselectAfter()` when selection should be cleared after completion.

## Modal transport

Page props include authorized descriptors, not handlers. Direct actions submit JSON; confirmation actions prompt first. Form actions GET their authorized `{ spec, state }`, then POST `{ data, ids? }` with `X-Pupitre-Action: 1` and JSON acceptance. Successful results use `ActionResult` fields for flash, patch, reload, redirect and deselect. Validation errors are 422 field errors; 403 preserves the modal and reports denial. The runtime handles this protocol for you; do not submit action modals as ordinary Inertia page forms.

`.deepLinkable()` uses `?action=name` and optional `&record=id`. Loading a URL only opens an available/enabled descriptor, and GET/POST still authorize on the server. Closing removes those query parameters.

## Queue execution and rate limits

`.async()` applies to bulk actions and imports. Without a jobs adapter they run synchronously. Queue payloads contain serializable identities, not callback closures or HTTP objects. Worker execution reloads user, tenant, definitions and scoped records. A handler running in a job context must not assume an HTTP response/session is present.

Configure the queue [adapter](/guides/adapters/) and worker before enabling queued work. `.rateLimit(5, { per: '1m', by: 'user' })` uses the limiter driver; `by` is user or IP, and violations return 429 JSON. Include meaningful failure handling in your domain code rather than reporting success before work finishes.

For toast and persistent inbox messages, use [notifications](/guides/notifications/).
