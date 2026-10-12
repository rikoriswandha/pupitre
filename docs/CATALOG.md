# Pupitre — Catalog (kontrak komponen)

Catalog adalah daftar komponen yang boleh muncul di spec, lengkap dengan skema props Zod. Ia tinggal di `@rikology/pupitre/catalog`, hanya bergantung pada `zod`, dan dipakai oleh tiga pihak:

- **compiler** (server) memvalidasi spec yang ia hasilkan sebelum dikirim (hanya di dev/test; prod skip);
- **`pupitre-react`** membangun registry json-render dari catalog;
- **`pupitre-ui`** dan komponen host mengimplementasikan props-nya; penggantian komponen type-checked.

Catalog diekspor dari `@rikology/pupitre/catalog` sebagai data biasa + Zod (`pupitreCatalog = { components: { [Type]: { props, slots, description } }, actions: { [name]: { params, description } } }`), karena subpath ini hanya boleh bergantung pada `zod`. `pupitre-react` membungkusnya dengan `defineCatalog(schema, pupitreCatalog)` dari `@json-render/core` + `@json-render/react/schema`. Prop yang boleh berupa ekspresi dideklarasikan dengan `dynamic(schema)`: input menerima literal atau ekspresi json-render, output tipe Zod tetap tipe literal sehingga props komponen registry bertipe bersih. `catalogVersion` = `major.minor` dari package `pupitre`; renderer menolak spec dengan major berbeda.

## 1. Props yang diterima semua komponen

Ditambahkan oleh `defineRegistry` json-render, bukan dideklarasikan di props Zod: `element`, `children`, `emit`, `state`, `setState`, `loading`, `parentId`. Pupitre menambahkan lewat context (`usePanel()`): `locale`, `timezone`, `density`, `urlFor`.

Lokalisasi menambahkan shared props opsional `pupitre.messages?: Record<string, string | { one: string; other: string; zero?: string }>` dan `pupitre.locales?: string[]`; `pupitre.locale` tetap bahasa efektif. Ini penambahan non-breaking, bukan tipe komponen baru. `t()` server hanya menandai copy UI; boundary response menerjemahkan marker sesuai request dan tidak menyentuh data record/string biasa. `t()` client memakai kamus shared secara sinkron; key literal Inggris, interpolasi `{name}`, plural melalui `params.count`. Host menambah/override kamus di `config.i18n.messages`; plugin mengisi `definePlugin({ messages: { id: { ... } } })`.

Konvensi props lintas komponen:

| Prop | Tipe | Catatan |
| --- | --- | --- |
| `name` | `string` | path field tanpa prefix |
| `label` | `string \| null` | `null` = sembunyikan label |
| `helperText`, `hint` | `string \| null` | |
| `hintIcon`, `hintTooltip`, `hintColor`, `hintAction` | ikon, tooltip/warna opsional, `ActionDescriptor` | ikon dan tooltip hint; action berjalan melalui protokol action form |
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
| Mask | `9` digit, `a` huruf, `*` alfanumerik; literal ditampilkan tetapi tidak disimpan. State/dehydrate membawa nilai tanpa delimiter mask. `.tel()` memvalidasi nomor dengan regex permisif; `.telRegex(regex)` menggantinya. |
| `Textarea` | `rows`, `autosize`, `maxLength`, `placeholder` | `string \| null` |
| `Number` | `min`, `max`, `step`, `prefix`, `suffix`, `inputMode` | `number \| null` |
| `Hidden` | — | any |
| `Select` | `options: Option[]`, `searchable: boolean \| string[]`, `multiple`, `native`, `placeholder`, `optionsUrl`, `preload`, `createOption?: { url }`, `prefixAction`/`suffixAction: ActionDescriptor`, `clearable` | `string \| number \| null` atau array kalau `multiple`; async mode debounces `q`, hydrates selected labels, dan mengambil halaman berikutnya |
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
| `MarkdownEditor` | `toolbar`, `uploadUrl`, `preview` | string Markdown; preview klien memakai DOMPurify dan upload lampiran field |
| `CodeEditor` | `language`, `lineNumbers`, `minHeight` | string; CodeMirror 6 + bahasa pilihan dimuat lazy |
| `FileUpload` *(domain)* | lihat §3 | |
| `Slider` | `min`, `max`, `step`, `marks`, `range` | number / `[number, number]` |

`Option = { value: string | number; label: string; description?: string; disabled?: boolean; icon?: string; color?: string }`.
Opsi closure menerima `{ search, ctx, page, values? }`; saat validasi, `search` kosong dan `values` berisi pilihan yang harus tetap dikembalikan meski labelnya tidak cocok dengan filter pencarian.

### 2.2 Layout

| Komponen | Props | Children |
| --- | --- | --- |
| `Grid` | `columns: number \| { default, sm, md, lg, xl }`, `gap` | elemen |
| `Section` | `heading`, `description`, `icon`, `collapsible`, `collapsed` (`$bindState /ui/section/<id>/collapsed`), `aside`, `compact`, `columns`, `footerActions` | elemen |
| `Fieldset` | `label`, `columns` | elemen |
| `Tabs` | `id`, `tabs: { key, label, icon?, badge? }[]`, `active` (`$bindState /ui/tabs/<id>`), `persistInUrl` | elemen `Tab` (`key`, `label`), urutan = `tabs` |
| `Wizard` | `id`, `steps: { key, label, description?, icon?, fields? }[]`, `step` (`$bindState /ui/wizard/<id>/step`, indeks 0-based), `skippable`, `submitLabel` | anak `Step` per key; semua langkah tetap ter-mount dan langkah berisi error aktif setelah 422 |
| `Group` | `relationship?` (hanya metadata) | elemen |
| `Split` | `from: 'md'\|'lg'`, `ratio` | 2 slot |
| `Placeholder` | `label`, `content` (ekspresi / `$computed`) | — |
| `Html` | `content` (sanitized server-side) | — |
| `Divider` | — | — |
| `Actions` | `actions: ActionDescriptor[]`, `alignment`, `fullWidth` | — |

Tabs memakai anak `Tab` biasa, **bukan** named slots: json-render hanya mengenal nama slot yang dideklarasikan statis di catalog (SPIKE Q4). Semua panel tab dan wizard tetap ter-mount; yang tidak aktif disembunyikan agar state input tidak hilang. Wizard menavigasi dengan indeks 0-based dan menggunakan daftar `fields` untuk memilih langkah error pertama setelah validasi server.

### 2.3 Infolist entries

`TextEntry`, `IconEntry`, `ImageEntry`, `ColorEntry`, `KeyValueEntry`, `RepeatableEntry`, `CodeEntry`, `BadgeEntry`. Props: `label`, `value` (sudah terformat server), `copyable`, `url`, `color`, `icon`, `placeholder` (kalau kosong), `columnSpan`.

## 3. Lapis domain (descriptor)

Komponen "gemuk": menerima satu prop `descriptor` bertipe Pupitre, punya state internal dan protokol jaringan sendiri. Tidak dimaksudkan untuk diganti sebagian; host mengganti seluruh komponen atau menyesuaikan lewat sub-komponen yang diekspor (`DataTable.Row`, `DataTable.Pagination`, ...).

| Komponen | Descriptor | Protokol |
| --- | --- | --- |
| `Form` | `{ method, url, submitLabel, cancelUrl?, keyBindings, dirtyGuard }` | `submitForm` bridge |
| `DataTable` | `TableDescriptor` + top-level prop `dataProp` (default `data`; lihat WIRE_PROTOCOL §5, ADR-0011) | `useTable` → partial reload `only: [dataProp]`; query dapat dibatasi dengan `queryPrefix`; row/bulk action lewat `useRunAction`; M3: `PATCH column`, `POST reorder` |

| `Repeater` | field props umum (`name`, `label`, `helperText`, `hint`, `required`, `columnSpan`) + `descriptor: { name, minItems, maxItems, reorderable, collapsible, collapsed, cloneable, addLabel, grid, defaultItems }` + `value` terikat ke array; anak tunggal `RepeaterItem` (`index: { $index: true }`, opsional `itemLabel` expression dalam scope item) sebagai template | event `add` → `pushState` (item baru `_key: '$id'`); hapus/pindah/klon/collapse dikerjakan komponen lewat nilai array terikat (`useSetState`), karena param action tidak bisa menyatakan path array induk di scope bersarang |
  `.relationship('items', { orderColumn? })` hanya mendukung Lucid `hasMany`. Edit memuat baris terkait bersama primary key internal `_relationKey`; saat simpan server memeriksa ulang ownership, menyinkronkan insert/update/delete dalam transaksi resource, dan mengisi urutan bila `orderColumn` ditetapkan.
| `Builder` | field props umum (`name`, `label`, `helperText`, `hint`, `required`, `columnSpan`) + `descriptor: { name, blocks: { key, label, icon?, template: ElementId }[], minItems?, maxItems?, reorderable, collapsible, cloneable, addLabel?, blockPickerColumns? }` | nilai array item `{ _key, type: blockKey, data: { ...fields } }`; template block terikat ke `data.*`, Vine memilih schema dari `type`, menolak tipe tak dikenal, dan membuang `_key` |
| `FileUpload` | `{ name, uploadUrl, deleteUrl, multiple, accept, maxSize, maxFiles, image, imageEditor?, imageEditorAspectRatios?, directory, visibility, reorderable, downloadable, previewable }` | `POST/DELETE /_pupitre/upload`; nilai state = `string \| string[]` (key); gambar dipotong di client dan tetap divalidasi server |
| `RelationSelect` | `Select` + `{ optionsUrl, createOption: { url, modal } }` | `fetchOptions`; `openAction` |
| `RelationManager` | `RelationDescriptor { key, relation, label, group?, icon?, badge?, url, dataProp, queryPrefix, table, actions, readOnly }` pada `page.relations` | Tab di bawah form/infolist; top-level deferred `dataProp` dan tabel query diprefix menurut relasi; RelationGroup mengelompokkan tab, policy parent/related model dijalankan server-side; `readOnly` mematikan aksi mutasi |
| `ActionBar` | `{ actions: ActionDescriptor[] }` | `openAction` / `runAction` |
| `ActionModal` | internal: dipasang oleh runtime, bukan dari spec | `ActionFormResponse` |
| `Widget.Stats` | `WidgetDescriptor` (`name`, `dataProp`, `dataUrl`, `placement`, `span`, `sort`, `poll?`) + `{ kind: 'stats', stats: { label, value, description?, descriptionIcon?, color?, chart?: number[] }[] }` | `WidgetGrid` menampilkan warna/icon stat dan polling mengambil `GET dataUrl` |
| `Widget.Chart` | `WidgetDescriptor` + `{ kind: 'chart', labels, datasets }`; `chartType` memilih `line\|bar\|area\|pie\|doughnut` | deferred prop / `GET dataUrl`; chart memakai komponen UI khusus |
| `Widget.Table` | `WidgetDescriptor` + `TableDescriptor` (`dataProp` = top-level widget prop, `queryPrefix` = nama widget) | Query model, filter, sort, pagination, formatter server, dan renderer `DataTable`/`useTable` berbagi jalur tabel resource |
| `Widget.Timeline` | `WidgetDescriptor` (`kind: 'timeline'`) + `{ kind: 'timeline', items: { title, description?, time: { iso, formatted }, actor?, icon?, color?, changes?: { field, old, new }[] }[] }` | Daftar aktivitas berurutan mengikuti server; waktu terformat server, aktor, icon/warna, perubahan nilai lama/baru, empty state, dan deferred/poll melalui `WidgetGrid` |

| `GlobalSearch` | `{ url, keyBinding, placeholder }` | `GET /_pupitre/search` |
| `NotificationTray` | `{ url, readUrl, poll? }` | `GET /_pupitre/notifications` |
| `TenantSwitcher` | dari `pupitre.tenants` | `visit` |
| `View` | `{ component: string, props }` — komponen React host dari registry host | — |
| `Fragment` | sub-spec dari host (`children` saja) | — |
`page.subNavigation` menambahkan navigasi record sekunder (edit, view, relations, nested) di bawah page header; parent record title tetap muncul di breadcrumbs.
Widget descriptor dikirim di `page.widgets`, sedangkan hasil (`WidgetData`) berada di prop top-level bernama `dataProp`; `deferred` menyebut prop yang belum dimuat. Dashboard dan halaman resource memakai descriptor yang sama. `dataUrl` menunjuk endpoint GET panel-scoped untuk refresh/poll; query filter dashboard dikirim kembali. Widget record menyertakan `resource` dan `record` pada URL, dan server memeriksa scoped record sebelum memuatnya. Nilai `span` 1–4 mengikuti jumlah kolom grid (1 di ponsel, 2 pada breakpoint md, hingga 4 di xl); `'full'` mengisi seluruh baris.
Descriptor M3 tabel membawa `editable.url`, `poll` (ms), `reorderable.url`, `deferFilters`, `deferLoading`, dan `gridColumns`. Kolom dapat mendeklarasikan `individuallySearchable` dan `summarize`; ringkasan diproses melalui agregat SQL atas query terfilter (termasuk per grup). Baris membawa `className` hasil `.rowClass()` yang dibatasi ke token class aman. `DataTable` mengirim perubahan edit/reorder dengan CSRF, menangani rollback optimistis + toast, dan menyimpan visibilitas kolom per `descriptor.id`.
M4 menambahkan `TableDescriptor.realtime?: { channel }` dan `pupitre.realtime?: { driver, userChannel }`. Schema `realtimeEvent` memvalidasi ping `{ type: 'pupitre:table', resource }` atau `{ type: 'pupitre:notification' }`; tipe `RealtimeClient` menyediakan `subscribe(channel, onEvent)` yang mengembalikan cleanup. Dengan client pada `<Pupitre realtime={client}>`, `useRealtimeSubscription` dan `useTableRealtime` menggantikan polling dengan partial reload yang sama; tanpa client/channel, polling tetap berlaku. Penambahan opsional ini tidak mengubah `catalogVersion`.

`ActionDescriptor.deepLink` menandai modal/konfirmasi yang boleh dibuka lewat `?action=<name>[&record=<id>]`; server tetap memeriksa izin saat GET form. `modal.footerActions` adalah descriptor tombol modal tambahan yang menjalankan URL action dengan data form saat ini; `modal.submit`/`modal.cancel` menyembunyikan tombol submit/cancel saat `false`. Shortcut `keyBindings` dipasang pada action header dan action di luar row tabel; shortcut row sengaja tidak dipasang karena target record ambigu.

`NotificationItem.actions` serta `FlashMessage.actions` berisi `{ label, url?, method?: 'get'|'post', markAsRead? }`. Tray dan toaster merender action; `markAsRead: true` pada aksi tray menandai item sebagai dibaca ketika aksi dipilih.
Ekspor/impor menggunakan response schemas di wire: `exportJobResponse`/`exportProgressResponse` untuk job CSV, `importPreviewResponse` untuk header/sample row/field mapping, `importResultResponse` untuk ringkasan per-row, dan `importJobResponse` untuk async import. Bridge memvalidasi setiap respons sebelum memperbarui UI.

`DataTable` descriptor filter dapat menyertakan sub-spec form. Bungkus spec itu sebagai `{ $raw: spec }` agar ekspresinya tetap utuh sampai `SpecRenderer` memprosesnya dengan store filter sendiri; jangan gunakan wrapper ini untuk prop elemen biasa.

QueryBuilder menambahkan filter domain `{ type: 'queryBuilder', name, label, constraints }`; constraint membawa `name`, `type`, `label`, `options?` dan allowlist `operators: [{ value, label }]`. Tipe meliputi text/number/date/boolean/select/relationship. Atribut SQL, konfigurasi relasi dan timezone tetap server-only. Editor `DataTable` menyimpan JSON OR-of-AND di `filters[name]`, mendukung negasi, reset serta filter defer; batas dan validasi server ada di WIRE_PROTOCOL §5 dan ADR-0025. Ini bukan sub-spec form custom.

`TableDescriptor.defaultSorts` menyatakan array prioritas; `defaultSort` lama tetap kolom primer. `multiSort` adalah batas kolom untuk tabel opt-in. URL memakai token sort berurutan dipisahkan koma; primary header saja memakai `aria-sort`, sementara tombol tambah/hapus/prioritas dapat dioperasikan lewat keyboard. `sort=` membersihkan default secara eksplisit.

## 4. Shell

`Shell`, `Toaster`, `Modal`, `ConfirmDialog`, `NotFound`, `ImportModal`. Dirender dari `pupitre.nav`/`page.*`, bukan dari spec; prop-nya bertipe di `@rikology/pupitre-react` (`ShellProps`, `ModalProps`, ...) dan didaftarkan di map `components` yang sama dengan komponen catalog (`defineRegistry(components)`), sehingga host bisa mengganti satu per satu. `ImportModal` menangani upload CSV, preview header/mapping, hasil row, dan link CSV gagal. Sidebar, topbar, breadcrumb, user menu, page header, dan empty state adalah bagian dalam `Shell`/`DataTable` di `pupitre-ui`.


Konfigurasi tema panel berasal dari `defineTheme()` atau `.theme()` dan diserialisasi sebagai `panel.theme` (lihat [Wire Protocol §1](./WIRE_PROTOCOL.md#1-props-halaman-inertia)). Shell mengubah warna/`vars` menjadi CSS custom properties, memakai skala `density` untuk kontrol, dan menghormati `contentWidth` serta font. Tema khusus dapat disimpan di `app/admin/themes/<panel>.ts`; `indexAdmin()` menerbitkan barrel `themes` menurut ID file. `stylesheet` dan URL font harus same-origin atau HTTPS, dan nilai CSS ditolak jika mengandung delimiter/instruksi yang dapat menyisipkan aturan.

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
| `evaluate` | `{ url, resource, field, debounce? }` | M3; debounced POST `/_pupitre/evaluate` from a server-backed field watch; merges only server-approved `/data/**` pointers. |
| `fetchOptions` | — | M2; not part of the M1 catalog or client runtime |
| `upload` | `{ field, files }` | `POST /_pupitre/upload` |
| `toast` | `{ type, title, body? }` | tampilkan toast lokal |
| `copy` | `{ text }` | clipboard |

## 6. Fungsi `$computed` bawaan

`concat`, `add`, `sub`, `mul`, `div`, `sum(array)`, `count`, `formatNumber(value, { locale, decimals, currency })`, `formatDate(value, { format, timezone })`, `pluck(array, key)`, `join`, `upper`, `lower`, `truncate`, `coalesce`. `args` json-render berbentuk record (`{ $computed: 'mul', args: { a, b } }`), bukan array. Daftar nama diekspor sebagai `computedFunctionNames`; implementasinya `builtInFunctions` di `pupitre-react`. Host dapat menambah lewat `defineRegistry(components, { functions })`; compiler (closure lifter) hanya memakai nama di `computedFunctionNames`.

## 7. Ekstensi catalog dan aturan evolusi

Host dapat menambah field, column, dan entry tanpa mengubah catalog inti. `defineCatalogExtension({ name, components })` dari `@rikology/pupitre/catalog` menerima map nama PascalCase ke `{ kind: 'field' | 'column' | 'entry', props: z.object(...), description }`. Modul ini hanya bergantung pada Zod; jangan mengimpor Vine, Lucid, React, atau modul server ke file bersama tersebut.

`props` mendeklarasikan konfigurasi khusus, misalnya `max: z.number().int().min(1).max(10).optional().default(5)`. Props umum (`label`, `value`, error, binding dan ekspresi) digabung berdasarkan kind. `CatalogExtension` merupakan tipe publik; `mergeCatalogExtensions(extensions)` menghasilkan bentuk catalog seperti `pupitreCatalog`, dengan metadata `kind` dihapus dari definition json-render.

Factory server dibuat lewat `defineField`, `defineColumn`, dan `defineEntry` di entry utama `@rikology/pupitre`. Ketiganya menerima kind lokal serta `{ extension, component, methods }`; field menambahkan `validate`, dan dapat menambahkan `dehydrate`; column/entry dapat menambahkan `format`. `methods` adalah map fungsi bertipe yang mengembalikan patch props, bukan mutasi builder:

```ts
export const rating = defineField('rating', {
  extension: ratingCatalog,
  component: 'StarRating',
  methods: { stars: (max: number) => ({ max }) },
  validate: (props) => vine.number().withoutDecimals().min(0).max(props.max ?? 5),
})

rating('rating').label(t('Rating')).stars(5).required()
```

Factory dipanggil langsung, bukan `schema.rating(...)`. Method dasar field tetap tersedia dan immutable. Validasi Vine dijalankan dari definition server pada submit resource, form action, dan child repeater; schema Zod memvalidasi konfigurasi komponen, bukan otorisasi atau payload user.

Daftarkan catalog pada plugin server `definePlugin({ name: 'star-rating', catalog: [ratingCatalog] })` agar metadata ekstensi tersedia pada panel, lalu tambahkan plugin ke `.plugins([...])`. Client tetap wajib menyediakan komponen: `defineRegistry({ ...components, StarRating, StarRatingColumn, StarRatingEntry }, { extensions: [ratingCatalog] })`. Field memakai `useBoundValue(props.value, bindings?.value)` dan `useFieldError(props.error, bindings?.value)` agar path repeater dan modal mengikuti store masing-masing.

Contoh lokal ada di `apps/example/admin/rating_catalog.ts`, server builder `app/admin/extensions/rating.ts`, dan komponen `inertia/admin/extensions/StarRating.tsx`. Resource Comments menampilkan rating pada create/edit, tabel, view, action modal, dan repeater criteria. Radio native mendukung keyboard, target minimal 24px, status terpilih non-warna, token tema, serta semua teks melalui `t()`. E2E `43_catalog_extension.spec.ts` membuktikan round-trip dan penolakan payload rating di luar batas.

- Menambah prop opsional / komponen baru → minor.
- Mengubah tipe prop, menghapus prop, mengganti nama komponen → major; `pupitre-react` menolak spec major berbeda dan meminta reload.
- Setiap komponen memiliki spec fixture di `packages/pupitre/catalog/fixtures.ts` (`catalogFixtures`), yang dipakai (a) test Zod di catalog, (b) Playwright component test di `pupitre-ui` (`tests/ct`), dan (c) test registry host memakai `assertRegistryComplete(pupitreCatalog, components)`.
- Aturan di atas berlaku pada versi package inti. Komponen ekstensi mengikuti semver package host/plugin sendiri: prop opsional adalah minor, perubahan tipe/penghapusan prop/nama komponen adalah major. `catalogVersion` hanya mendeteksi ketidakcocokan core, bukan versi plugin; rilis builder server, catalog dan registry client ekstensi harus dideploy bersama.
- Fixture ekstensi berada pada test host/plugin, bukan ditambahkan ke `catalogFixtures` inti. Nama komponen stabil dalam satu versi; bila dua major perlu hidup bersamaan, gunakan nama komponen yang berbeda agar registry tidak tertimpa.
