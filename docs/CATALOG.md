# Pupitre — Catalog (kontrak komponen)

Catalog adalah daftar komponen yang boleh muncul di spec, lengkap dengan skema props Zod. Ia tinggal di `@rikology/pupitre/catalog`, hanya bergantung pada `zod`, dan dipakai oleh tiga pihak:

- **compiler** (server) memvalidasi spec yang ia hasilkan sebelum dikirim (hanya di dev/test; prod skip);
- **`pupitre-react`** membangun registry json-render dari catalog;
- **`pupitre-ui`** dan komponen host mengimplementasikan props-nya; penggantian komponen type-checked.

Catalog diekspor dari `@rikology/pupitre/catalog` sebagai data biasa + Zod (`pupitreCatalog = { components: { [Type]: { props, slots, description } }, actions: { [name]: { params, description } } }`), karena subpath ini hanya boleh bergantung pada `zod`. `pupitre-react` membungkusnya dengan `defineCatalog(schema, pupitreCatalog)` dari `@json-render/core` + `@json-render/react/schema`. Prop yang boleh berupa ekspresi dideklarasikan dengan `dynamic(schema)`: input menerima literal atau ekspresi json-render, output tipe Zod tetap tipe literal sehingga props komponen registry bertipe bersih. `catalogVersion` = `major.minor` dari package `pupitre`; renderer menolak spec dengan major berbeda.

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
| `Tabs` | `id`, `tabs: { key, label, icon?, badge? }[]`, `active` (`$bindState /ui/tabs/<id>`), `persistInUrl` | elemen `Tab` (`key`, `label`), urutan = `tabs` |
| `Wizard` (M3) | `steps: { key, label, description?, icon? }[]`, `step` (`$bindState /ui/wizard/<id>/step`), `skippable`, `submitLabel`, `startOnStep` | elemen `Step` per `key` (pola Tabs) |
| `Group` | `relationship?` (hanya metadata) | elemen |
| `Split` | `from: 'md'\|'lg'`, `ratio` | 2 slot |
| `Placeholder` | `label`, `content` (ekspresi / `$computed`) | — |
| `Html` | `content` (sanitized server-side) | — |
| `Divider` | — | — |
| `Actions` | `actions: ActionDescriptor[]`, `alignment`, `fullWidth` | — |

Tabs memakai anak `Tab` biasa, **bukan** named slots: json-render hanya mengenal nama slot yang dideklarasikan statis di catalog (SPIKE Q4). Semua panel tab tetap ter-mount (state tidak hilang), yang tidak aktif disembunyikan. Wizard (M3) akan memakai pola yang sama.

### 2.3 Infolist entries

`TextEntry`, `IconEntry`, `ImageEntry`, `ColorEntry`, `KeyValueEntry`, `RepeatableEntry`, `CodeEntry`, `BadgeEntry`. Props: `label`, `value` (sudah terformat server), `copyable`, `url`, `color`, `icon`, `placeholder` (kalau kosong), `columnSpan`.

## 3. Lapis domain (descriptor)

Komponen "gemuk": menerima satu prop `descriptor` bertipe Pupitre, punya state internal dan protokol jaringan sendiri. Tidak dimaksudkan untuk diganti sebagian; host mengganti seluruh komponen atau menyesuaikan lewat sub-komponen yang diekspor (`DataTable.Row`, `DataTable.Pagination`, ...).

| Komponen | Descriptor | Protokol |
| --- | --- | --- |
| `Form` | `{ method, url, submitLabel, cancelUrl?, keyBindings, dirtyGuard }` | `submitForm` bridge |
| `DataTable` | `TableDescriptor` + prop Inertia top-level `data` (lihat WIRE_PROTOCOL §5, ADR-0011) | `useTable` → `reload({ only: ['data'] })`; row/bulk action lewat `useRunAction`; M3: `PATCH column`, `POST reorder` |
| `Repeater` | `{ name, minItems, maxItems, reorderable, collapsible, collapsed, cloneable, addLabel, itemLabel ($template), grid, defaultItems }` + `value` terikat ke array; anak tunggal `RepeaterItem` (`index: { $index: true }`) sebagai template | event `add` → `pushState` (item baru `_key: '$id'`); hapus/pindah/klon/collapse dikerjakan komponen lewat nilai array terikat (`useSetState`), karena param action tidak bisa menyatakan path array induk di scope bersarang |
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

`Shell`, `Toaster`, `Modal`, `ConfirmDialog`, `NotFound`. Dirender dari `pupitre.nav`/`page.*`, bukan dari spec; prop-nya bertipe di `@rikology/pupitre-react` (`ShellProps`, `ModalProps`, ...) dan didaftarkan di map `components` yang sama dengan komponen catalog (`defineRegistry(components)`), sehingga host bisa mengganti satu per satu. Sidebar, topbar, breadcrumb, user menu, page header, dan empty state adalah bagian dalam `Shell`/`DataTable` di `pupitre-ui`.

Komponen yang butuh payload runtime (DataTable, ActionBar, FileUpload, Repeater item) memakai hook `pupitre-react` (`useTable`, `useRunAction`, `useUpload`, `useSetState`, `useBoundValue`, `useFieldError`, `useVisit`, `useNavigationGuard`, `SpecRenderer` untuk sub-spec) karena event json-render tidak membawa payload; `pupitre-ui` tidak pernah mengimpor `@json-render/*`.

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
| `evaluate` | `{ field }` | M3 (WP31): `POST /_pupitre/evaluate` → `set` hasilnya. Di M1 compiler tidak pernah memancarkannya; handler client hanya memberi peringatan dev |
| `fetchOptions` | `{ field, q, page }` | M2 (WP25): `GET /_pupitre/options` → `/options/<field>`; sama, belum dipancarkan di M1 |
| `upload` | `{ field, files }` | `POST /_pupitre/upload` |
| `toast` | `{ type, title, body? }` | tampilkan toast lokal |
| `copy` | `{ text }` | clipboard |

## 6. Fungsi `$computed` bawaan

`concat`, `add`, `sub`, `mul`, `div`, `sum(array)`, `count`, `formatNumber(value, { locale, decimals, currency })`, `formatDate(value, { format, timezone })`, `pluck(array, key)`, `join`, `upper`, `lower`, `truncate`, `coalesce`. `args` json-render berbentuk record (`{ $computed: 'mul', args: { a, b } }`), bukan array. Daftar nama diekspor sebagai `computedFunctionNames`; implementasinya `builtInFunctions` di `pupitre-react`. Host dapat menambah lewat `defineRegistry(components, { functions })`; compiler (closure lifter) hanya memakai nama di `computedFunctionNames`.

## 7. Aturan evolusi

- Menambah prop opsional / komponen baru → minor.
- Mengubah tipe prop, menghapus prop, mengganti nama komponen → major; `pupitre-react` menolak spec major berbeda dan meminta reload.
- Setiap komponen punya fixture spec di `packages/pupitre/catalog/fixtures/<Component>.json` (diekspor sebagai `catalogFixtures`) yang dipakai (a) test Zod di catalog, (b) Playwright component test di `pupitre-ui` (`tests/ct`), (c) test registry host memakai `assertRegistryComplete(pupitreCatalog, components)`.
