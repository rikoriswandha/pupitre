---
title: "Forms and schema"
description: "Compose typed form fields and layouts, configure validation and reactive state, and manage relationships and file uploads."
sidebar:
  label: "Forms"
---

A form schema describes editable fields and their layout for a resource, custom page or action. The same builders connect the rendered inputs to server validation and reactive state.

![Field Notes 01 edit form showing title, slug, status, publication date, category, views, a priority slider and content editors.](/screenshots/post-form-light.webp)

Use resource `.form((s) => [...])`, page `.form(...)`, or action `.form([schema.text(...)])`. The callback namespace and exported `schema` share component factories. Builders are immutable, and containers accept builder arrays via `.components()` (repeaters use `.schema()`). The [schema API reference](/reference/api-schema/) contains every factory and option with its exact signature.

## Input catalog

Every named field below is created with `schema.<factory>('attribute')`.

| Factories | Important options and behavior |
| --- | --- |
| `text`, `email`, `password` | Prefix/suffix, autocomplete, datalist; text mask and tel; password revealable; field actions |
| `number` | min/max/step, prefix/suffix |
| `slider` | min/max/step/marks; `.range()` for two-number values |
| `textarea` | rows, autosize, length limits |
| `hidden` | Hidden data field; still validated/dehydrated according to configuration |
| `select`, `multiSelect` | Static/dynamic options, searchable, preload, clearable, relationships, create-option form |
| `checkbox`, `checkboxList` | Single boolean or multiple options; checkbox inline; list columns |
| `radio` | Options, descriptions, inline layout |
| `toggle`, `toggleButtons` | Toggle icons/colors; buttons options, icons/colors, multiple/grouped |
| `date`, `dateTime`, `time` | minDate/maxDate, timezone, seconds |
| `color` | Presets and color format |
| `tags` | Suggestions, separator, maxTags, reorderable |
| `keyValue` | Key/value labels/placeholders, add/delete/reorder controls |
| `richEditor` | Toolbar, height limits, attachment disk/directory |
| `markdownEditor` | Toolbar, attachment disk/directory or `.fileAttachments({ disk, directory })` |
| `codeEditor` | Language, line numbers, minimum height; lazy CodeMirror editor |
| `fileUpload` | Disk/directory, accept, size/count, multiple, image editor, visibility, previews/downloads |
| `repeater` | Repeated schema, item limits, labels, grid, reorder/collapse/clone, hasMany relationship |
| `builder` | Named blocks, item limits, reorder/collapse/clone, block-picker columns |

Common field methods include `.label()`, `.helperText()`, `.hint()`, `.hintIcon(icon, { tooltip })`, `.hintColor()`, `.hintAction()`, `.placeholder()`, `.default()`, `.disabled()`, `.readOnly()`, `.visible()`, `.hidden()`, `.columnSpan()`, `.extraAttributes()`, `.live()`, `.afterStateUpdated()`, `.dehydrated()`, `.dehydratedWhenHidden()`, `.format()`, `.dehydrate()` and `.rules()`.

## Layout catalog

| Factory | Structure |
| --- | --- |
| `grid()` | `.columns(numberOrResponsiveMap).gap(number).components([...])` |
| `section(heading?)` | Heading, description, icon, collapse, aside, compact, columns and components |
| `fieldset(label?)` | Label, columns, components |
| `tabs(tabs?)`, `tab(name)` | Tabs composed of named tab children |
| `group(name?)`, `fragment(children?)` | Child grouping without a new input |
| `split(...children)` | Side-by-side components, optional columns |
| `wizard(steps?)`, `step(name)` | Steps with schema/components, icon/description; wizard startOnStep/skippable/submitLabel |
| `placeholder(name)` | Label and content, including a supported reactive closure |
| `html(content?)` | Sanitized HTML content |
| `divider()` | Visual separator |
| `view(component, props?)` | Host React component registered under that name |
| `block(name)` | Builder block with label/icon and `.schema([...])` |

Layout visibility and column span are supported where listed by the reference. Entry factories are documented in [infolists](/guides/infolists/).

## Validation and dehydration

```ts
.form((s) => [
  s.text('title').required().minLength(3).maxLength(200)
    .unique({ table: 'posts', column: 'title', ignoreRecord: true }),
  s.number('price').required().min(0),
  s.text('confirmation').same('title').dehydrated(false),
])
```

Rules compile to VineJS on the server. Depending on field kind, rules include required/nullable, min/max/step, minLength/maxLength, email/url/regex/alpha/alphaNumeric, in/same/different/confirmed, unique/exists and custom `.rules([...])`. A method on one field type is not automatically available on every other type; consult the typed reference.

Visibility is presentation, not authorization or validation. Hidden fields are not automatically excluded: use `.dehydratedWhenHidden(false)` when they should be omitted. `.dehydrated(false)` prevents persistence of a field. `.format()` and `.dehydrate()` are server transformations. Repeater validation produces nested paths such as `items.0.sku` and strips internal UI keys.

## Reactivity and closure lifting

```ts
.form((s) => [
  s.select('status').options({ draft: 'Draft', published: 'Published' }).live(),
  s.dateTime('publishedAt').visible(({ get }) => get('status') === 'published'),
  s.number('quantity').live().afterStateUpdated(({ get, set }) =>
    set('total', get('quantity') * get('price'))),
])
```

`.live()` runs client-first; `.live({ onBlur: true })` waits for blur, and `.live({ debounce: 300 })` debounces. Simple `get('literal.path')` comparisons, logical visibility expressions, templates, arithmetic and allowed built-in computed calls become declarative json-render expressions. An `afterStateUpdated` client handler must be expressible as supported `set('literal.path', expression)` statements. Arbitrary helper calls, request context, record access, loops and complex branching are not general client JavaScript.

Unliftable visibility/content/label conditions are evaluated on the server for the initial request, not made magically reactive. An unliftable client watch throws `E_PUPITRE_UNLIFTABLE_CLOSURE`; opt in explicitly:

```ts
s.text('title').live({ server: true, debounce: 300 })
  .afterStateUpdated(({ get, set }) => {
    const slug = String(get('title')).toLowerCase().replaceAll(' ', '-')
    set('slug', slug)
  })
```

Server watches post current form data to `/_pupitre/evaluate`. Pupitre resolves the registered form/field, authorizes create/update (or page access), loads scoped records and restricts returned setters to allowed form data paths. Never treat a client record snapshot as authoritative. Inspect outcomes using `node ace pupitre:inspect posts --json`.

There is **no browser eval or new Function**. `$computed` refers to a named function in the registry, not a function string. Keep your Content Security Policy; do not enable `unsafe-eval` for Pupitre.

## Options and relationships

```ts
s.select('authorId').relationship('author', 'name').searchable().preload()
```

Async options callbacks receive `{ search, ctx, page, values? }`. On validation, `values` contains submitted IDs and search is empty; return labels/options for those IDs even if they do not match a search label. Relationship options are tenant-scoped and related-model policies protect lookup and validation. Use `.createOptionForm([...]).createOptionUsing(callback)` for authorized creation. Text/select prefix and suffix actions use the normal action protocol.

## Repeaters, builders and wizards

```ts
schema.repeater('items')
  .schema([schema.text('sku').required(), schema.number('quantity').min(1)])
  .relationship('items', { orderColumn: 'position' })
  .reorderable().collapsible().cloneable()

schema.builder('content').blocks([
  schema.block('heading').label('Heading').schema([schema.text('text').required()]),
])

schema.wizard([
  schema.step('Details').components([schema.text('title').required()]),
  schema.step('Publishing').components([schema.toggle('published')]),
])
```

Relationship repeaters synchronize hasMany children transactionally. Submitted child IDs must belong to the parent. Builder items use `{ _key, type, data }` in UI state; server validation strips `_key` and validates by block schema. Wizard steps stay mounted, preserving input; 422 errors select the first step containing an error. The wizard does not replace final server validation with client per-step validation.

### Table repeaters

Use table mode for compact, comparable line items:

```ts
s.repeater('items')
  .schema([s.text('sku').required(), s.number('quantity').required().min(1)])
  .table([
    s.tableColumn('SKU').width('8rem').markAsRequired(),
    s.tableColumn('Qty').alignment('end').markAsRequired(),
  ])
  .defaultItems(1).minItems(1).maxItems(20).reorderable().cloneable()
```

Columns map to the schema's direct children **by order**, not by label or field name.
An explicit column list must contain exactly one column per schema child; mismatches
are rejected with `E_PUPITRE_INVALID_REPEATER_TABLE`. Call `.table()` without
arguments to derive headers and required marks from the fields' labels and rules.
Implicit headers require static field labels. If a field has a closure-valued label,
provide explicit `tableColumn(...)` labels; otherwise compilation rejects it with
`E_PUPITRE_INVALID_REPEATER_TABLE` rather than silently replacing the configured label.
Column `.markAsRequired()` only controls the header mark: field `.required()` still
controls server validation.

Table mode keeps the same bindings, async option endpoints, live/server watchers,
relationship synchronization, dirty guard, item limits and per-cell server errors
(`items.0.sku`). Add, remove and clone controls include the row number in their
accessible names. Reorder with the up/down buttons, the drag handle's ArrowUp/
ArrowDown keys, or drag the handle onto another row. The table scrolls horizontally
on narrow screens; field labels remain available to screen readers.

`.itemLabel()`, `.grid()`, `.collapsed()` and `.collapsible()` are ignored in table
mode: column headers replace item headings and rows remain visible. Disabled or
read-only repeaters prevent both cell changes and row operations. The Orders
example uses table mode with tenant-scoped async Product options.


## Files and editors

```ts
schema.fileUpload('cover').image().imageEditor()
  .imageEditorAspectRatios(['16:9', '1:1', null])
  .disk('uploads').directory('covers').maxSize('5mb')
  .visibility('private')
```

Configure the Drive disk before using uploads. MIME/size checks happen on the server even when the browser crops, rotates or flips an image. Multiple upload values are lists; keep disk visibility appropriate for your data. Rich/Markdown attachments use the same field upload boundary. Markdown preview and stored rich content are sanitized; don't bypass the registry contract to inject unsanitized HTML.

Resource, page, plugin and editor uploads default to **10 MiB** unless the field sets an explicit size limit. Profile avatars have a **5 MiB** limit and CSV imports a **10 MiB** limit. The server checks the actual temporary-file size before reading, bounds the read and rejects files that grow beyond the limit; browser validation is not the security boundary.

MIME detection uses magic bytes, not the browser's declaration. SVG, HTML/XHTML and JavaScript are rejected explicitly; avatar and editor image uploads accept only passive images. Set host body-parser/proxy limits and storage quotas too. CSV imports are private, and downloadable CSV/failed-row reports use attachment disposition and `nosniff`.

### Upload retention and scheduled cleanup

On upgrade, run `node ace pupitre:install` and `node ace migration:run` to publish/apply the `pupitre_uploads` migration. Without that table, uploads continue working but abandoned-upload tracking is disabled with a one-time warning; the prune command exits non-zero with migration instructions.

Schedule `node ace pupitre:prune-uploads --older-than=24h` hourly in your host cron/job scheduler (`7d` is also supported). Each invocation processes at most 100 non-skipped old unconsumed uploads or stale claims. Skipped candidates do not consume that capacity: a stable `(created_at, key)` cursor pages past them, examining at most ten times the processing limit (1,000 rows for the command). If the scan cap is reached, newer candidates wait for another invocation; a retained backlog at that cap may require host review. Tracker rows store the panel, owner resource/custom-page slug, and field path; references are checked only against that owner's resource model/field, including soft-deleted and cross-tenant records. Consumed uploads, recent uploads and referenced keys are retained; uploads created before this migration are not swept.

Resource submissions, including **built-in list-page create/edit modals**, custom-page submissions, and resource/relation/page **action forms** reserve session-owned uploads **after validation and before** host persistence or action handlers, preventing a concurrent prune from deleting files being saved. Failed validation consumes nothing; failed persistence may retain reserved files. This conservative retention intentionally favors data safety. Rich-editor attachments on submitted fields are retained by this consumption step. Custom persistence outside Pupitre's form submission boundary must not adopt an unconsumed upload key directly.

Queued bulk-action forms validate and reserve uploads in the HTTP request before enqueueing; the worker does not depend on the uploader's session.

Permanent record deletion cleans file-upload objects after commit, including multiple values and nested repeaters. Soft deletion retains them, and another row of the same model/column sharing a key prevents deletion (including rows from another tenant). Cleanup errors are logged without failing the committed request. Inline rich/Markdown attachment cleanup remains outside the existing replaced-file cleanup scope.

Pruning atomically claims each tracker row before deleting its bytes. A submission that reserves the row first keeps the object; a submission arriving after the prune claim is rejected before persistence. Storage deletion failures release the claim for retry, and any candidate error makes the command exit non-zero. Relationship-repeater fields and unmapped model columns retain candidates conservatively rather than querying nonexistent parent columns. Reference reads batch keys per field and include soft-deleted/cross-tenant records. Ordinary saves with no relevant session uploads or no upload-capable fields do not probe the tracking table; successful table probes are cached per connection, while a missing table is checked again on later upload operations.

Conservative retention applies only to the candidate's own file-upload field: custom pages, relationship repeaters, unmapped columns, and unresolvable owners/fields are skipped without marking the upload consumed. Unconsumed editor attachments are abandoned and are deleted once old enough. The command reports skipped counts and exits zero unless an error occurred. Prune claims use `consumed_at = -1` and refresh `created_at` to the claim time; claims older than `--older-than` are retried after a crash. A storage failure restores the original timestamp and unconsumed status.

## Rich editor: merge tags, mentions, and custom blocks

Rich-editor content stays an HTML string. Tiptap and its extensions load only when the editor mounts.
Declare supported merge tags as identifiers or an identifier-to-label object:

```ts
import { mentionProvider, richBlock, schema } from '@rikology/pupitre'

const callout = richBlock('callout')
  .label('Callout')
  .icon('info')
  .schema((f) => [
    f.text('title').required(),
    f.select('tone').options({ info: 'Information', warning: 'Warning' }).required(),
  ])
  .toHtml(({ config }) => `${config.tone}: ${config.title}`)

schema.richEditor('body')
  .mergeTags({ name: 'Customer name', today: 'Today' })
  .mentions([
    mentionProvider('@').options([{ id: 'alice', label: 'Alice' }]),
    mentionProvider('#').search(async (query, ctx) => searchPermittedProjects(query, ctx)),
  ])
  .customBlocks([callout])
```

`searchPermittedProjects` is your application lookup: authorize the related resource before querying,
use `scopedQuery(ctx, resource)`, and authorize individual records before returning `{ id, label }`.
Never query an unscoped model or expose records just because the user can edit the parent.

Type `{{` to choose a merge tag, or use **Merge tags** in the toolbar. Type the provider's trigger
(`@` or `#`) to open suggestions; Arrow Up/Down selects an item and Enter inserts it.
Async providers use the existing authenticated options endpoint, not a separate public route.
Create searches require the form owner's `create` ability; edit searches resolve the supplied
record through tenant scope and require `viewAny` and record `update`.

Mentions store `data-type="mention"`, `data-id`, `data-label`, and `data-char` on a span.
Saving checks static membership or reruns the search callback using the submitted label and request
context. Unknown IDs/providers lose their mention metadata, and valid labels are canonicalized
from the provider. The HTML sanitizer removes scripts, event handlers, and unsupported data attributes.

**Insert block** opens the block's schema in an isolated modal form. **Edit block** reopens its
configuration. Blocks store a div with `data-type="customBlock"`, `data-id`, and JSON `data-config`.
On resource/action form save, Pupitre validates configuration against that block's VineJS schema;
invalid data returns 422 with paths such as `body.blocks.0.title`. Unknown block IDs are dropped,
undeclared configuration keys are removed, and malformed or non-object JSON is rejected.

Use the same block definitions in [`textEntry().richContent()`](/guides/infolists/) or
`renderRichContent()` when displaying the saved string. Block `toHtml` output is **escaped text by
default**. Add `.rawHtml()` only to an application-owned renderer that deliberately returns markup;
that output is still passed through the sanitizer. Merge-tag values are always escaped.

