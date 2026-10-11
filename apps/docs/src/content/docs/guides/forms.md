---
title: Forms and schema
sidebar:
  order: 3
---

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
