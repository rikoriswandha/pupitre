# Plan 004: Decide and prove the translatable record-field contract

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update this plan's status row in
> `plans/README.md`, unless your dispatcher maintains the index.
>
> **Drift check (run first)**: `git diff --stat 4e076fa..HEAD -- package.json package-lock.json packages/pupitre-translatable apps/example apps/docs/src/content/docs/guides/localization.md apps/docs/src/content/docs/plugins/translatable.md docs/adr docs/FILAMENT_PARITY.md plans/README.md`
> This checkout already contains extensive uncommitted/untracked plugin and
> app changes. The command above is NOT sufficient: compare every "Current
> state" excerpt below against the LIVE files, including untracked files,
> whether or not the command reports changes. STOP on any mismatch. Record
> the initial working-tree state and preserve other people's changes; never
> restore, clean, overwrite, or stage them wholesale.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `4e076fa`, 2026-10-13

## Why this matters

Pupitre already localizes interface copy, but changing language deliberately does not translate stored record content. A host that needs an English and Indonesian article title currently has to invent storage, locale validation, editor binding, and display behavior itself. This spike records a coherent opt-in contract and proves it with a small example and executable tests; it is not approval to deliver a complete translation platform or claim Filament parity.

## Current state

Pupitre is an npm-workspace AdonisJS v7 + Inertia React admin framework. Server builders emit catalog-constrained specs; the host owns React component registration. Relevant live evidence follows (quoted Indonesian text is intentionally preserved).

1. `packages/pupitre/src/builder/panel.ts:132-140` already defines default and allowed UI locales:
   ```ts
   locale(value: string): PanelBuilder {
     new Intl.PluralRules(value)
     return this.set({ locale: value })
   }
   locales(value: readonly string[]): PanelBuilder {
     if (!value.length || new Set(value).size !== value.length)
       throw new Error('Panel locales must be non-empty and unique')
     for (const locale of value) new Intl.PluralRules(locale)
     return this.set({ locales: [...value] })
   }
   ```
2. `docs/adr/0023-lazy-translation-markers.md:18` rejects implicit data translation:
   > Menerjemahkan semua string respons — mengubah isi record, identifier, URL, dan data host tanpa opt-in.
   `docs/adr/0023-lazy-translation-markers.md:8` explains why:
   > Definition panel/resource dimuat pada tingkat modul, sebelum ada request. Terjemahan saat builder dijalankan akan mengunci semua user pada satu bahasa dan berisiko mencampur locale antar request. UI React juga memerlukan terjemahan sinkron, sedangkan data record tidak boleh diterjemahkan hanya karena kebetulan sama dengan key katalog.
3. `apps/docs/src/content/docs/guides/localization.md:38` states:
   > Unmarked strings and record data are not translated. Only Pupitre's marker framing is removed; unrelated Unicode TAG characters (including subdivision flag emoji) are preserved through forms and exports. Wrap host labels, navigation groups, validation copy, action text, and accessibility labels explicitly; a database value such as a post title stays the same when the language changes.
   Leave this true for ordinary fields; document the new opt-in separately.
4. `docs/adr/0024-catalog-extensions.md:12` establishes the extension contract:
   > Tambahkan `defineCatalogExtension({ name, components })` pada `@rikology/pupitre/catalog`, dengan metadata kind field/column/entry dan props Zod. `mergeCatalogExtensions` menggabungkan definition dengan catalog inti dan menghapus kind dari definition json-render. Factory server `defineField`, `defineColumn`, dan `defineEntry` menerima extension, nama komponen, dan map method bertipe yang mengembalikan patch props; field menerima callback Vine `validate(props)` serta dehydrate opsional. Factory dipanggil langsung dan immutable. Plugin menyumbangkan `catalog: [extension]`, dan host browser mendaftarkan komponen melalui `defineRegistry(components, { extensions })`. Nama komponen atau kind yang bertabrakan ditolak, bukan menimpa definition diam-diam. Validasi payload tetap berasal dari definition server.
   `docs/adr/0024-catalog-extensions.md:19` rejects a global builder namespace:
   > Mendaftarkan namespace global `schema.rating`: menambah mutable state global dan menyamarkan kepemilikan factory. Import langsung `rating('rating')` lebih eksplisit.
5. `docs/CATALOG.md:180` requires shared catalogs to stay Zod-only:
   > Host dapat menambah field, column, dan entry tanpa mengubah catalog inti. `defineCatalogExtension({ name, components })` dari `@rikology/pupitre/catalog` menerima map nama PascalCase ke `{ kind: 'field' | 'column' | 'entry', props: z.object(...), description }`. Modul ini hanya bergantung pada Zod; jangan mengimpor Vine, Lucid, React, atau modul server ke file bersama tersebut.
   `docs/ARCHITECTURE.md:253` requires server-only plugin contributions:
   > `definePlugin({ name, register, resources, pages, widgets, middleware, navigation, catalog, messages, extendResource, boot })` mendefinisikan kontribusi server; plugin tidak memasang komponen React atau menyuntikkan renderer sendiri. Komponen UI plugin dikirim sebagai catalog extension yang didaftarkan host di `defineRegistry(..., { extensions })` (lihat "Ekstensi catalog" di bawah). Nama wajib kebab-case dan unik dalam `.plugins([...])`.
   `docs/adr/0008-optional-peers-as-subpath-drivers.md:7` includes the placement rule:
   > Plugin terpisah hanya untuk yang membawa UI/tabel sendiri (`shield`, `audit`, `transmit`).
   The quoted sentence is the final sentence of that line. A locale-tabbed editor and display components justify a plugin rather than a core field.
6. The exact field factory signature is `packages/pupitre/src/builder/extensions.ts:278-289`:
   ```ts
   export function defineField<
     const C extends CatalogExtension,
     const N extends keyof C['components'] & string,
     M extends ExtensionMethods = Record<never, never>,
   >(
     kind: string,
     options: Options<C, N, M> & {
       validate(props: ComponentProps<C, N>): SchemaTypes
       dehydrate?: FieldCommon['dehydrate']
       format?: FieldCommon['format']
     }
   ): (name: string) => ExtensionFieldBuilder<M> {
   ```
   `packages/pupitre/src/builder/extensions.ts:22-26` defines the options:
   ```ts
   > = {
     extension: C
     component: N
     methods?: M
   }
   ```
   `packages/pupitre/src/builder/extensions.ts:184-188` shows that `validate` receives extension props, not the field's base `rules.required`:
   ```ts
   export function extensionValueSchema(node: ExtensionMetadata): SchemaTypes {
     const registration = registrations.get(`${node.extension}:field:${node.extensionKind}`)
     if (!registration?.validate)
       throw new Error(`Pupitre extension field "${node.extensionKind}" has no validator`)
     return registration.validate(validateExtensionProps(node))
   ```
   This is a real spike question; simply returning `vine.object(...)` will not make `.required()` apply only to one locale.
7. `packages/pupitre-media/catalog.ts:5-16` is the closest plugin field catalog exemplar:
   ```ts
   export const mediaCatalog = defineCatalogExtension({
     name: 'media',
     components: {
       MediaPicker: {
         kind: 'field',
         description: 'Authorized reusable media selector',
         props: display.extend({
           multiple: z.boolean().default(false),
           maxItems: z.number().int().positive().max(100).default(5),
           accept: z.array(z.string()).default(['image/*']),
         }),
       },
   ```
   `packages/pupitre-media/src/fields.ts:8-18` shows server registration and Vine validation:
   ```ts
   export const mediaPicker = defineField('mediaPicker', {
     extension: mediaCatalog,
     component: 'MediaPicker',
     methods: {
       ...methods,
       multiple: (multiple = true) => ({ multiple }),
       maxItems: (maxItems: number) => ({ maxItems }),
       accept: (accept: string[]) => ({ accept }),
     },
     validate: (props) =>
       vine.any().use(
   ```
   `packages/pupitre-media/index.ts:28-30` publicly exports those factories:
   ```ts
   import { mediaColumn, mediaEntry } from './src/fields.js'
   export { PupitreMedia, mediaCatalog, mediaColumn, mediaEntry }
   export { mediaPicker } from './src/fields.js'
   ```
8. `packages/create-pupitre-plugin/README.md:9` documents:
   ```bash
   create-pupitre-plugin star-rating --dir ./plugins/star-rating --with-ui
   ```
   `packages/create-pupitre-plugin/README.md:26-30` describes the generated files:
   > `catalog.ts`: a `defineCatalogExtension` with the field's Zod props schema.
   > `index.ts`: a plugin registering the catalog and a plugin-specific field factory using `defineField`. `.stars(count)` returns a props patch and configures server-side Vine validation.
   > `react.tsx`: an accessible numeric rating input using `useBoundValue` and `useFieldError`, with associated label, help and errors, plus required/disabled/read-only behavior.
   > Public `.`, `./catalog`, and `./react` exports, matching tsdown entries and declaration output.
   > React, renderer, Vine and Zod peer/development dependencies and generated Japa manager/validation tests. UI templates require Pupitre and pupitre-react 1.1+ (the first catalog-extension release) and Zod 4.
   For this official plugin spike, keep the generated React implementation in the HOST, not the plugin: the generic UI template is not authority to violate the official-plugin boundary.
9. Existing JSON-related field names do not imply identical payloads. `packages/pupitre/src/definition/schema.ts:295-305` defines `keyValue` configuration (`keyLabel`, `valueLabel`, add/delete/reorder flags); `:316-323` defines `codeEditor` languages, including `'json'`. But `packages/pupitre/src/compiler/vine_compiler.ts:320-326` treats the latter as a string:
   ```ts
   case 'textarea':
   case 'hidden':
   case 'richEditor':
   case 'markdownEditor':
   case 'codeEditor':
   case 'color':
     schema = vine.string()
   ```
   Do not store a serialized JSON string as the field's wire value.
10. `apps/example/app/models/order.ts:27-29` uses Lucid JSON conversion:
    ```ts
    @column(jsonColumn) declare items: OrderItem[] | null
    @column() declare total: number
    @column(jsonColumn) declare shippingAddress: Record<string, string> | null
    ```
    `apps/example/app/models/product.ts:6-11` defines that conversion:
    ```ts
    /** Text column holding JSON; keeps SQLite and other dialects identical. */
    export const jsonColumn = {
      prepare: (value: unknown) =>
        value === null || value === undefined ? null : JSON.stringify(value),
      consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
    }
    ```
    `apps/example/app/models/post.ts:23-29` already consumes JSON on Post:
    ```ts
    export default class Post extends Auditable(PostSchema) {
      @column() declare coverMediaId: number | null
      @column({
        prepare: (value) => JSON.stringify(value),
        consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
      })
      declare items: Array<{ sku: string; qty: number; price: number }>
    ```
    Do not convert Post's existing scalar `title`: use a new `localizedTitle` property instead.
11. `apps/example/database/migrations/1791800200001_add_post_summary.ts:6-10` is an additive idempotent migration exemplar:
    ```ts
    async up() {
      if (!(await this.schema.hasTable(this.tableName))) return
      if (!(await this.schema.hasColumn(this.tableName, 'summary'))) {
        this.schema.alterTable(this.tableName, (table) => table.text('summary').nullable())
      }
    }
    ```
12. `packages/pupitre/src/table/table_data.ts:67-68,96` demonstrates the display seam:
    ```ts
        : valueAt(serialized, column.name)
    if (column.kind === 'custom' && column.format) return column.format(value, serialized)
    ```
    ```ts
    if (column.kind !== 'text') return value
    ```
    The existing custom column can carry the raw locale map to its host component. The formatter has no locale argument; do not capture a mutable global locale to work around that.
    `packages/pupitre/src/http/middleware/share_props.ts:136-137` publishes request-local client state:
    ```ts
    locale: ctx.pupitre.locale,
    locales: [...(panel.locales ?? [panel.locale ?? 'en'])],
    ```
    `packages/pupitre/src/table/export_service.ts:12-18` reads explicit dotted export paths:
    ```ts
    function rawValue(record: LucidRow, name: string): unknown {
      let value: unknown = record.serialize()
      for (const part of name.split('.')) {
        if (!value || typeof value !== 'object') return undefined
        value = (value as Record<string, unknown>)[part]
      }
      return value
    }
    ```
13. `apps/example/inertia/admin/registry.ts:10-13` is the host extension-registration pattern:
    ```ts
    export const registry = defineRegistry(
      { ...components, StoreTipsWidget, StarRating, StarRatingColumn, StarRatingEntry },
      { extensions: [ratingCatalog, mediaCatalog] }
    )
    ```
    `apps/example/app/admin/extensions/rating.ts:7-10,31` uses a direct factory and catalog plugin:
    ```ts
    export const rating = defineField('rating', {
      extension: ratingCatalog,
      component: 'StarRating',
      methods,
    ```
    ```ts
    export const ratingPlugin = definePlugin({ name: 'star-rating', catalog: [ratingCatalog] })
    ```
14. `packages/create-pupitre-plugin/template-ui/tests/plugin.spec.ts:20-24` boots the public manager:
    ```ts
    const manager = new PupitreManager(app)
    await manager.boot([definePanel('admin').plugins([pluginUnderTest()])])
    assert.isDefined(manager.getPanel('admin'))
    } finally {
      await app.terminate()
    ```
    `packages/pupitre/testing/index.ts:55-61` supplies the public spec assertion:
    ```ts
    export type SpecExpectation = {
      type: string
      name?: string
      props?: Record<string, unknown>
    }

    export function assertSpecHas(spec: JsonRenderSpec, expected: SpecExpectation): void {
    ```
    Use the generated manager test and `packages/pupitre/tests/unit/compiler/catalog_extensions.spec.ts:42-59` (field, column, entry factory examples) as structural patterns.
15. `docs/FILAMENT_PARITY.md:187` marks UI localization ✅; `:211` still combines several unimplemented features:
    > | filament-spatie-laravel-translatable, filament-tree/adjacency-list, comments, approvals, Spotlight | — | ⬜ | Belum dikerjakan; permintaan lebih rendah |
    Split only translatable from that row and mark it as a design/prototype, not ✅.
16. `package.json:10-26` explicitly enumerates workspaces, rather than using `packages/*`; `:30-39` defines the verification commands in the next section. New package registration therefore requires a root workspace entry. `docs/adr/0000-template.md:1-16` defines the ADR structure: title, Status, Tanggal, Konteks, Keputusan, Alternatif yang ditolak, Konsekuensi.

## Commands you will need

Run from the repo root with Node 24+ and npm 11+. Do not install a second package manager.

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Drift inventory | `git status --short` plus the drift command above | Inventory recorded; live excerpts match |
| Scaffold using the checked-out implementation | `node --conditions=@rikology/source --import=@poppinss/ts-exec packages/create-pupitre-plugin/bin/create.ts translatable --dir packages/pupitre-translatable --with-ui` | Fresh package created; no existing files overwritten |
| Refresh workspace lock/linking, executor only | `npm install` | Root lockfile updated only for intended workspace/dependencies |
| All workspace types | `npm run typecheck` | exit 0 |
| New plugin tests | `npm test -w packages/pupitre-translatable` | exit 0; manager, validation, spec and resolver tests pass |
| Example types | `npm run typecheck -w apps/example` | exit 0 |
| Example functional tests | `npm test -w apps/example` | exit 0 on isolated test DB |
| Public exports | `npm run verify:exports` | exit 0; server/catalog boundary preserved |
| English/Indonesian keys | `npm run i18n:check` | exit 0 |
| Lint | `npm run lint` | exit 0; no official-plugin React import |
| Docs types/content | `npm run check -w apps/docs` | exit 0 |
| Optional browser gate | `npm run e2e -w apps/example -- e2e/44_translatable.spec.ts` | all new browser scenarios pass on isolated seeded DB |

The scaffolder command is the local-source equivalent of its documented `create-pupitre-plugin ... --with-ui` usage; it avoids fetching a potentially older published scaffold. The advisor has NOT run these gates. Run migration/test/browser commands only against disposable test databases, never the existing development or production DB.

## Scope

**In scope** (only these paths may change):
- `docs/adr/0028-translatable-record-fields.md` (new; if taken, next free number after 0029).
- `packages/pupitre-translatable/**` (new scaffold, server factory/catalog, locale resolver, tests, README and CHANGELOG; no final React imports/exports).
- `package.json`, `package-lock.json` (workspace entry and dependency/link changes only).
- `apps/example/package.json` (local plugin dependency only).
- `apps/example/app/admin/extensions/translatable.ts` (new host-local schema helper/config).
- `apps/example/app/admin/panels/admin.ts` (plugin registration and explicit default locale/config reuse).
- `apps/example/inertia/admin/extensions/Translatable.tsx` (new editor, column and entry).
- `apps/example/inertia/admin/extensions/translatable_value.ts` (new pure display resolver wrapper if needed).
- `apps/example/inertia/admin/registry.ts` (components + shared catalog).
- `apps/example/app/admin/resources/post_resource.ts` (one localized title demo, table/infolist and explicit export columns).
- `apps/example/app/models/post.ts` (new host-owned JSON property).
- `apps/example/database/migrations/<13-digit-timestamp>_add_post_localized_title.ts` (new; choose unused timestamp).
- `apps/example/tests/functional/translatable.spec.ts` (new SQLite persistence/authorization test).
- `apps/example/e2e/44_translatable.spec.ts` (new; use next unused filename if occupied).
- `apps/docs/src/content/docs/plugins/translatable.md` (new prototype guide).
- `apps/docs/src/content/docs/guides/localization.md` (link and distinction only).
- `docs/FILAMENT_PARITY.md`, `plans/README.md` (prototype status only).

**Out of scope**:
- All existing core source, catalog, core models and UI/runtime source. If the spike needs a new core context hook, report the missing seam instead of introducing it here.
- Existing scalar `Post.title`, slugs, record titles, tenant ownership, policies, search/sort behavior, and other plugins.
- Translation tables, automatic translation services, locale ACLs, import UX, translated full-text search, JSON SQL indexing, queued current-locale exports, rich-editor attachments/mentions/custom blocks inside the wrapper, registry distribution/publishing.
- A global `schema.translatable` registration or compatibility shim.

## Git workflow

- Branch: `advisor/004-translatable-field-spike`.
- Start with `git status --short`; preserve the dirty baseline. Do not reset, clean, or bulk-stage.
- Commit logical units only when requested by the operator; use conventional messages such as `docs: decide translatable record field contract` and `feat(translatable): prove locale map field prototype`.
- Stage exact task-owned paths/hunks. Do NOT push or open a PR.

## Steps

### Step 1: Record the decisions and bounded prototype in ADR-0028

Check `docs/adr/` first. 0027 is reserved for a separate tenant-parity plan and 0029 for a separate workflow plan; use `0028-translatable-record-fields.md` if free, otherwise the next free number after 0029 and substitute it throughout this plan. Follow `docs/adr/0000-template.md`, write English prose, and mark the decision **Proposed** until evidence supports it. Include alternatives, the questions below, and an evidence table mapping each answer to its test.

Decide these contracts; recommended defaults:

| Decision | Recommended default for this spike |
| --- | --- |
| Placement | New server-only `@rikology/pupitre-translatable` plugin: it brings its own editor/display UI, but the host registers/carries React components. No core field. |
| API spelling | Plugin exports `translatable(name, options)` and a host helper `withTranslatableSchema(baseSchema, config)` returning `{ ...baseSchema, translatable }`. Use `s.translatable(...)` only on this local immutable helper, never mutate core `schema` or global registration. |
| Wrapped base | `options.field` accepts a base text, textarea or richEditor definition for the same name; default is text. Preserve label/help/disabled/readOnly/required, supported string rules and editor config. Reject unsupported field kinds/config explicitly. No arbitrary composite field wrapping. |
| Locale defaults | Shared immutable host config `{ locales: ['en', 'id'], defaultLocale: 'en' }` feeds panel and plugin/helper. Omitted `locales` inherits this config; explicit locales must be a nonempty unique subset containing defaultLocale. Validate locale tags at configuration time. Do not infer default from current request locale. |
| Storage | Host JSON column holding `{ [locale]: string }`; nullable outer value allowed when field optional. Wire value is an object, never a JSON string. Reject arrays/nested values/unconfigured keys; preserve other configured translations on editing one tab. No tables or core model changes. |
| Required | `.required()` requires a nonblank default-locale value only; every other locale remains optional. `.required(false)` restores optional semantics. Changing the UI locale never changes requiredness. Empty rich HTML must follow core rich-editor validation behavior. |
| Validation | Vine per locale; reuse public `compileValidator` with the wrapped base definition to preserve string rules and rich HTML validation/sanitization. Prefix child error paths with `<name>.<locale>`; propagate validated/sanitized strings rather than the raw input. |
| Display | Custom table/infolist components receive the authorized map and use the current request's `usePage().props.pupitre.locale`. Resolve exact locale → configured fallback(s) → panel default, deduplicated; missing/blank entries continue the chain; no available value displays `—`. Never call `t()` on record values. |
| Export | Explicit per-locale columns, e.g. `localizedTitle.en` and `localizedTitle.id`, without display fallback. This avoids an unproven request-context formatter seam and gives lossless translation data. Missing values export empty/null, never another locale's text. |
| Prototype status | Unpublished, proposed contract, not parity-complete. No version-wide promise of automatic registry installation. |

Open questions to answer explicitly in the ADR (a recorded answer, not a TODO):
- Does local `s.translatable` composition retain useful TypeScript inference without violating ADR-0024? Recommend direct factory as the canonical API, local `s` as ergonomic host composition only.
- Can a small immutable wrapper synchronize `.required()` into extension props without changing core? Recommend a plugin facade over the extension builder; every base chain method must return a wrapped immutable builder, and `.required()` updates both outer presence and `requireDefault` extension config. Do not add a colliding `required` method to `defineField.methods`.
- Which base-field rules/config are actually reusable via public `compileValidator`? Recommend explicit supported set and construction-time rejection of relation/file/context-dependent rules; text, textarea and basic richEditor must each be proven.
- Should empty string count as untranslated? Recommend yes for display fallback; keep literal valid strings unchanged.
- Does returning full locale maps expose anything not already allowed by field/record authorization? Recommend all configured translations have the same field permissions; do not invent locale-specific ACLs.
- Does a future server-renderer/current-locale export need a contextual formatter API? Record the current two-argument formatter limitation; do not implement that unrelated core API in this spike.

**Verify**: `test -f docs/adr/0028-translatable-record-fields.md` (substitute chosen number) → exit 0; all table decisions and questions have an explicit answer in the note.

### Step 2: Scaffold and retain only the server/catalog package boundary

Run the local scaffolder command in the Commands table, without `--force`. Add the package to the explicit root workspaces and the example dependency with the repo's existing local dependency convention. Rename generated rating artifacts to the translatable contract. Replace the generated navigation/rating demo rather than leaving dead demo exports.

Move the generated `react.tsx` concept into `apps/example/inertia/admin/extensions/Translatable.tsx`; remove the generated plugin `/react` export, React build entry, and React/runtime dependencies if unused. Plugin catalog must import only Zod and `@rikology/pupitre/catalog`; server factory may import Pupitre and Vine. The resolver belongs in a pure `./locale` subpath usable from server and host browser, with matching source/types/build exports and no Adonis/React imports. README must show host-owned components rather than promising automatic installation. Align generated package configs with existing workspace source conditions before running tests.

**Verify**: `npm run typecheck -w packages/pupitre-translatable` → exit 0; `npm run lint` → exit 0 with server-only plugin boundaries intact.

### Step 3: Prove factory, requiredness, per-locale validation and specs

Implement `catalog.ts`, `index.ts`, `src/fields.ts`, and `src/locale.ts` in the new package. Catalog components: `TranslatableInput`, `TranslatableColumn`, `TranslatableEntry`; config includes locales, defaultLocale, fallback chain and editor kind. Use `defineField`, `defineColumn`, `defineEntry`, and `definePlugin({ name: 'translatable', catalog: [translatableCatalog] })`; preserve map values on column/entry definitions, rather than stringifying them on the server.

Build the wrapper by composition over the extension builder. It must synchronize `requireDefault` with `.required()` and never mutate a field shared by another panel/resource. `validate(props)` cannot read base requiredness automatically (see evidence); prove the facade handles it. Nested validation should clone/rebuild the supported base definition for each locale and use public `compileValidator`; forward child errors and mutate the locale value to the validated result. Do not duplicate core rich-editor sanitization or suppress failures. Do not cast away unsupported base rules to pass types.

Add `tests/plugin.spec.ts`, `tests/translatable.spec.ts`, and `tests/locale.spec.ts`. Retain the generated public-manager boot/terminate test. Add compiled spec snapshots using the public compiler API and `assertSpecHas` from `@rikology/pupitre/testing`; assert type `TranslatableInput`, name/config, and whole-object binding. Follow the existing core catalog-extension tests for fixtures, but do not import private core modules into the new published package.

**Verify**: `npm test -w packages/pupitre-translatable` → exit 0, including the cases listed below; `npm run verify:exports` → exit 0.

### Step 4: Demonstrate one JSON field in the example host

Add nullable host property `Post.localizedTitle: Record<string, string> | null` with JSON prepare/consume handling matching existing Post/Order patterns. Create an additive idempotent migration for `posts.localized_title`, using a host JSON column and no new table. Use a fresh 13-digit timestamp and guards matching the summary migration; if SQLite represents JSON as text, conversion must still yield an object and PostgreSQL must not double-parse driver-decoded objects. Do not change old `title` data, seeded record titles, slugging or sorting. Tests supply localized fixtures; existing rows may remain null. No schema regeneration against a development DB.

Create `apps/example/app/admin/extensions/translatable.ts` exporting shared config and the local helper; configure the panel explicitly with the same default/allowed locales. Register plugin plus catalog/components without removing rating/media. Add the field as a clearly separate "Localized title" demo and corresponding custom column/entry; use a text base there. Cover textarea and basic richEditor through additional test fixtures, not more production DB columns.

The host component implements accessible locale tabs with stable IDs, tablist/tab/tabpanel roles, keyboard selection, selected text/state, and labels/help/errors linked to the active input. Reuse public UI Text/Textarea/RichEditor components and runtime binding/error hooks, not raw custom rich HTML editing. Bind child editors to the parent object path plus locale, including repeater/modal prefixes; unmounting/switching a tab must not discard siblings. Readonly/disabled applies across tabs. Read locale directly from request page props, not a mutable module variable. Column/entry render escaped text with fallback; rich contents are not rendered with raw `dangerouslySetInnerHTML` in the generic display.

Configure explicit export columns for `localizedTitle.en`/`.id` using dotted paths and labels. Never export the custom column map as an accidental JSON blob or substitute a fallback into a locale-specific column.

**Verify**: `npm run typecheck -w apps/example` → exit 0; `npm test -w apps/example` → exit 0 with isolated JSON create/edit/read/export tests. Optional seeded browser gate from Commands → all tab, error, persistence and display scenarios pass.

### Step 5: Publish the evidence and prototype documentation

Write the plugin README/CHANGELOG and docs plugin page with install/import paths, direct factory/local helper examples, panel config, host registry wiring, JSON model/migration contract, required-default semantics, fallback, per-locale export and explicit prototype limitations. Add a link from localization while preserving its statement about ordinary record data. Split translatable out of the combined parity row and label it "ADR + tested prototype; not complete parity"; leave the unrelated features unimplemented.

Update the ADR evidence table with exact tests and the outcomes of the six open questions. Mark Accepted only if the proposed contract is supported by all gates and reviewed; a successful Proposed spike may remain Proposed, but it must contain a concrete recommendation and no unresolved implementation placeholders. Do not claim unsupported rich-editor attachment features.

**Verify**: `npm run check -w apps/docs` → exit 0; `npm run typecheck && npm test -w packages/pupitre-translatable && npm run typecheck -w apps/example && npm run verify:exports && npm run i18n:check && npm run lint` → every command exits 0. Update `plans/README.md` with DONE only after all required evidence exists.

## Test plan

Use the generated `template-ui/tests/plugin.spec.ts` public-manager structure and the existing core `catalog_extensions.spec.ts` factory/spec pattern. Add named cases (at least 12 plugin tests; parameterized variants may share a named test):

- Manager boots a panel with plugin/catalog and terminates cleanly.
- Text, textarea, richEditor each validate locale-map strings; rich HTML follows core sanitizer/empty-value behavior.
- `.required()` rejects absent map, missing/blank default locale; accepts default only; ignores current UI locale for presence.
- `.required(false)` allows absent/null map and blank optional locale.
- Invalid locale config, missing default in subset, unknown payload key, array, nested object, number and serialized JSON payload are rejected (not silently dropped).
- Base max/min or equivalent supported string rule reports locale-specific error paths and preserves valid sibling values.
- Builder immutability: required/config modifications do not alter an earlier field or another panel.
- Form spec snapshot plus `assertSpecHas` contains custom type/config and correct root binding.
- Action/repeater fixtures preserve prefixes and `.en`/`.id` errors/bindings.
- Resolver: exact hit; blank/missing requested locale; ordered fallback; default; no value; duplicate fallback; unchanged English text matching a UI translation key; no cross-request state.
- Column/entry specs retain map value and custom component identity.
- Explicit per-locale export helper/config never applies display fallback.

Example functional tests use an isolated SQLite DB: add migration twice safely; persist/reload/update `localizedTitle`; distinguish raw JSON text from already-decoded values; retain sibling locale on tab save; separate scalar title stays unchanged; unauthorized/other-tenant record edits and exports remain denied through the ordinary resource pipeline. Browser test covers text and textarea tabs, a basic rich editor fixture, keyboard tab selection, default-locale error focus, readonly/disabled, en/id locale switching with fallback, and create/edit round-trip. Do not weaken policies to make test fixtures work.

**Verification**: new plugin test command and example functional test command exit 0. The optional browser gate requires an isolated seeded environment; if not available, record it as not exercised, not passed.

## Done criteria

ALL must hold:

- [ ] ADR-0028 (or documented next free number) exists and follows the ADR template; every decision and question has an evidence-backed answer.
- [ ] New plugin has real field/column/entry/catalog/resolver exports and public-manager tests; no generated rating/navigation leftovers or implementation TODOs.
- [ ] No React or pupitre-react import survives in the new official plugin; host registers the editor/display components explicitly.
- [ ] At least 12 named plugin tests exist and pass, including all three base editors, required-default behavior, malicious shapes, immutability, snapshots and fallback.
- [ ] `assertSpecHas` is used from `@rikology/pupitre/testing` and a deterministic compiled spec snapshot exists in the new package tests.
- [ ] Isolated example tests prove JSON round-trip, sibling preservation and explicit per-locale exports; scalar `Post.title` is unchanged.
- [ ] `npm run typecheck`, `npm test -w packages/pupitre-translatable`, `npm run typecheck -w apps/example`, `npm run verify:exports`, `npm run i18n:check`, `npm run lint`, `npm test -w apps/example`, and `npm run check -w apps/docs` exit 0.
- [ ] Documentation clearly says opt-in record data translation is separate from `t()`; parity row describes a prototype, not ✅.
- [ ] Initial dirty baseline is preserved; task-owned changes touch only Scope paths (inspect `git status --short` against baseline, not against a presumed clean tree).
- [ ] `plans/README.md` row updated, or dispatcher explicitly owns the index.

## STOP conditions

Stop and report, without improvising, if:

- Any live excerpt has drifted, the destination package already exists, or a required task-owned hunk overlaps unexplained existing work.
- Supported base text/textarea/basic richEditor validation cannot be reused through public APIs without private imports or weakening sanitization.
- `.required()` cannot be kept immutable and synchronized with default-locale validation inside the plugin facade.
- Whole-object locale binding does not preserve siblings or cannot correctly handle modal/repeater paths using public runtime hooks.
- Display requires a new core context hook, a mutable global locale, hidden React imports in core/plugin, or a global schema namespace mutation.
- The actual export pipeline cannot emit explicit per-locale dotted columns without a core change. Report the seam; do not quietly serialize the map or implement only current-locale export.
- A migration/test command targets an existing development/production database, or safe SQLite/PostgreSQL JSON consumption cannot be demonstrated.
- A verification fails twice after a bounded fix attempt, or implementation requires files outside Scope.

## Maintenance notes

The plugin contract is deliberately opt-in and independent of lazy UI translation markers. Reviewers should scrutinize immutable requiredness, nested error paths, rich-editor validation reuse, and complete-map authorization; a tab switch must never delete another locale. Future work may add registry-distributed UI, contextual server formatters, translated search/sort, attachments and current-locale queued export, but this spike must not pretend those are delivered. If the runtime changes how nested bindings or page props are supplied, rerun the modal/repeater and locale-display tests. Keep server/catalog/host imports separated, and ship catalog/component versions together as required by ADR-0024.
