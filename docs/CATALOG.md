# Pupitre — Catalog (kontrak komponen)

Catalog adalah daftar komponen yang boleh muncul di spec, lengkap dengan skema props Zod. Ia tinggal di `@rikology/pupitre/catalog`, hanya bergantung pada `zod`, dan dipakai oleh tiga pihak:

- **compiler** (server) memvalidasi spec yang ia hasilkan sebelum dikirim (hanya di dev/test; prod skip);
- **`pupitre-react`** membangun registry json-render dari catalog;
- **`pupitre-ui`** dan komponen host mengimplementasikan props-nya; penggantian komponen type-checked.

Catalog dideklarasikan sekali dengan `defineCatalog(schema, { components, actions })` dari `@json-render/core`. `catalogVersion` = `major.minor` dari package `pupitre`; renderer menolak spec dengan major berbeda.

## 1. Props yang diterima semua komponen

Ditambahkan oleh `defineRegistry` json-render, bukan dideklarasikan di props Zod: `element`, `children`, `emit`, `state`, `setState`, `loading`, `parentId`. Pupitre menambahkan lewat context (`usePanel()`): `locale`, `timezone`, `density`, `urlFor`.

Konvensi props lintas komponen:

| Prop | Tipe | Catatan |
| --- | --- | --- |
| `name` | `string` | path field tanpa prefix |
| `label` | `string \| null` | `null` = sembunyikan label |
| `helperText`, `hint` | `string \| null` | |
| `required` | `boolean` | hanya tanda bintang; validasi di server |
| `disabled`, `readOnly` | `boolean` | boleh ekspresi |
| `value` | sesuai field | `$bindState` / `$bindItem` |
| `error` | `string \| null` | `$state: /errors/<path>` |
| `columnSpan` | `number \| 'full'` | dipakai parent `Grid`/`Section` |
| `extraAttributes` | `Record<string,string>` | diteruskan ke elemen DOM root |

## 2. Lapis primitif (field & layout)

Props Zod sederhana; satu-satu bisa diganti host. Nama komponen = PascalCase dari nama builder.

### 2.1 Input

| Komponen | Props khusus | Nilai |
| --- | --- | --- |
| `Text` | `type: 'text'\|'email'\|'password'\|'url'\|'tel'`, `placeholder`, `prefix`, `suffix`, `prefixIcon`, `suffixIcon`, `maxLength`, `mask`, `autocomplete`, `datalist: string[]`, `revealable` (password) | `string \| null` |
| `Textarea` | `rows`, `autosize`, `maxLength`, `placeholder` | `string \| null` |
| `Number` | `min`, `max`, `step`, `prefix`, `suffix`, `inputMode` | `number \| null` |
| `Hidden` | — | any |
| `Select` | `options: Option[]`, `searchable`, `multiple`, `native`, `placeholder`, `optionsUrl` (dinamis), `preload`, `createOption?: { url }`, `clearable` | `string \| number \| null` atau array kalau `multiple` |
| `Checkbox` | `inline` | `boolean` |
| `CheckboxList` | `options`, `columns`, `searchable`, `bulkToggleable` | `(string\|number)[]` |
| `Radio` | `options`, `inline`, `descriptions` | scalar |
| `Toggle` | `onIcon`, `offIcon`, `onColor`, `offColor`, `inline` | `boolean` |
| `ToggleButtons` | `options`, `multiple`, `grouped`, `icons`, `colors` | scalar / array |
| `Date` · `DateTime` · `Time` | `min`, `max`, `displayFormat`, `timezone`, `seconds`, `native`, `weekStartsOn`, `disabledDates` | ISO string / `null` |
| `Color` | `format: 'hex'\|'rgb'\|'hsl'`, `presets` | string |
| `Tags` | `suggestions`, `separator`, `maxTags`, `reorderable` | `string[]` |
| `KeyValue` | `keyLabel`, `valueLabel`, `addable`, `deletable`, `reorderable`, `keyPlaceholder`, `valuePlaceholder` | `Record<string,string>` |
| `RichEditor` | `toolbar: string[]`, `uploadUrl`, `minHeight`, `maxHeight` | HTML string |
| `MarkdownEditor` | `toolbar`, `uploadUrl`, `preview` | string |
| `CodeEditor` | `language`, `lineNumbers`, `minHeight` | string |
| `FileUpload` *(domain)* | lihat §3 | |
| `Slider` | `min`, `max`, `step`, `marks`, `range` | number / `[number, number]` |

`Option = { value: string | number; label: string; description?: string; disabled?: boolean; icon?: string; color?: string }`.

### 2.2 Layout

| Komponen | Props | Children |
| --- | --- | --- |
| `Grid` | `columns: number \| { default, sm, md, lg, xl }`, `gap` | elemen |
| `Section` | `heading`, `description`, `icon`, `collapsible`, `collapsed` (`$bindState /ui/section/<id>/collapsed`), `aside`, `compact`, `columns`, `footerActions` | elemen |
| `Fieldset` | `label`, `columns` | elemen |
| `Tabs` | `tabs: { key, label, icon?, badge? }[]`, `active` (`$bindState /ui/tabs/<id>`), `persistInUrl` | slot per `key` |
| `Wizard` | `steps: { key, label, description?, icon? }[]`, `step` (`$bindState /ui/wizard/<id>/step`), `skippable`, `submitLabel`, `startOnStep` | slot per `key` |
| `Group` | `relationship?` (hanya metadata) | elemen |
| `Split` | `from: 'md'\|'lg'`, `ratio` | 2 slot |
| `Placeholder` | `label`, `content` (ekspresi / `$computed`) | — |
| `Html` | `content` (sanitized server-side) | — |
| `Divider` | — | — |
| `Actions` | `actions: ActionDescriptor[]`, `alignment`, `fullWidth` | — |

Tabs/Wizard memakai **named slots** json-render (`slots: { <key>: [ids] }`), bukan children datar, supaya tab tidak aktif tetap bisa divalidasi dan `dehydrated`.

### 2.3 Infolist entries

`TextEntry`, `IconEntry`, `ImageEntry`, `ColorEntry`, `KeyValueEntry`, `RepeatableEntry`, `CodeEntry`, `BadgeEntry`. Props: `label`, `value` (sudah terformat server), `copyable`, `url`, `color`, `icon`, `placeholder` (kalau kosong), `columnSpan`.

## 3. Lapis domain (descriptor)

Komponen "gemuk": menerima satu prop `descriptor` bertipe Pupitre, punya state internal dan protokol jaringan sendiri. Tidak dimaksudkan untuk diganti sebagian; host mengganti seluruh komponen atau menyesuaikan lewat sub-komponen yang diekspor (`DataTable.Row`, `DataTable.Pagination`, ...).

| Komponen | Descriptor | Protokol |
| --- | --- | --- |
| `Form` | `{ method, url, submitLabel, cancelUrl?, keyBindings, dirtyGuard }` | `submitForm` bridge |
| `DataTable` | `TableDescriptor` + `data` dari `page.data` (lihat WIRE_PROTOCOL §5) | `reload({ only })`, `PATCH column`, `POST reorder`, bulk actions |
| `Repeater` | `{ name, minItems, maxItems, reorderable, collapsible, collapsed, cloneable, addLabel, itemLabel ($template), grid, defaultItems }` + children template | `pushState`/`removeState`/`setState` (reorder = `setState` seluruh array) |
| `Builder` | `{ name, blocks: { key, label, icon, template: ElementId }[], ... Repeater }` | sama + `/data/<name>/<i>/type` |
| `FileUpload` | `{ name, uploadUrl, deleteUrl, multiple, accept, maxSize, maxFiles, image, imageEditor, directory, visibility, reorderable, downloadable, previewable }` | `POST/DELETE /_pupitre/upload`; nilai state = `string \| string[]` (key) |
| `RelationSelect` | `Select` + `{ optionsUrl, createOption: { url, modal } }` | `fetchOptions`; `openAction` |
| `RelationManager` | `{ relation, label, icon, url, table: TableDescriptor, actions: { header, row, bulk }, badge?, readOnly }` | sama seperti DataTable dengan prefix query |
| `ActionBar` | `{ actions: ActionDescriptor[] }` | `openAction` / `runAction` |
| `ActionModal` | internal: dipasang oleh runtime, bukan dari spec | `ActionFormResponse` |
| `Widget.Stats` | `{ name, url, poll?, columns }` + data `{ stats: { label, value, description?, descriptionIcon?, color?, chart?: number[] }[] }` | deferred prop / `GET /_pupitre/widgets/:name` |
| `Widget.Chart` | `{ name, url, type: 'line'\|'bar'\|'area'\|'pie'\|'doughnut', height, filters?: Spec, options }` + data `{ labels, datasets }` | sama |
| `Widget.Table` | `TableDescriptor` | sama seperti DataTable |
| `GlobalSearch` | `{ url, keyBinding, placeholder }` | `GET /_pupitre/search` |
| `NotificationTray` | `{ url, readUrl, poll? }` | `GET /_pupitre/notifications` |
| `TenantSwitcher` | dari `pupitre.tenants` | `visit` |
| `View` | `{ component: string, props }` — komponen React host dari registry host | — |
| `Fragment` | sub-spec dari host (`children` saja) | — |

## 4. Shell

`Shell`, `Sidebar`, `SidebarItem`, `SidebarGroup`, `Topbar`, `Breadcrumbs`, `UserMenu`, `PageHeader`, `EmptyState`, `Toast`, `AuthLayout`. Dirender dari `pupitre.nav`/`page.*`, bukan dari spec; tetap ada di registry agar bisa diganti.

## 5. Actions (json-render `actions`)

Didaftarkan di catalog dan diimplementasikan oleh bridge `pupitre-react`:

| Action | Params | Perilaku |
| --- | --- | --- |
| `setState`, `pushState`, `removeState`, `validateForm` | built-in json-render | — |
| `visit` | `{ url, method?, data?, preserveScroll? }` | `router.visit` |
| `reload` | `{ only: string[], data? }` | `router.reload` |
| `submitForm` | `{ formId? }` | kumpulkan `/data` → `router[method](url)` |
| `openAction` | `{ action: ActionDescriptor, ids? }` | sesuai `kind` |
| `runAction` | `{ url, method, ids? }` | `direct` tanpa dialog |
| `evaluate` | `{ field }` | `POST /_pupitre/evaluate` → `set` hasilnya |
| `fetchOptions` | `{ field, q, page }` | `GET /_pupitre/options` → `/options/<field>` |
| `upload` | `{ field, files }` | `POST /_pupitre/upload` |
| `toast` | `{ type, title, body? }` | tampilkan toast lokal |
| `copy` | `{ text }` | clipboard |

## 6. Fungsi `$computed` bawaan

`concat`, `add`, `sub`, `mul`, `div`, `sum(array)`, `count`, `formatNumber(value, { locale, decimals, currency })`, `formatDate(value, { format, timezone })`, `pluck(array, key)`, `join`, `upper`, `lower`, `truncate`, `coalesce`. Host dapat menambah lewat `defineRegistry(..., { functions })`; compiler hanya memakai nama yang terdaftar di `catalog.functions`.

## 7. Aturan evolusi

- Menambah prop opsional / komponen baru → minor.
- Mengubah tipe prop, menghapus prop, mengganti nama komponen → major; `pupitre-react` menolak spec major berbeda dan meminta reload.
- Setiap komponen punya fixture spec di `packages/catalog/fixtures/<Component>.json` yang dipakai (a) test Zod di catalog, (b) story/visual test di `pupitre-ui`, (c) test registry host memakai `assertRegistryComplete(catalog, components)`.
