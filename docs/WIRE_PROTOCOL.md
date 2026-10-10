# Pupitre — Wire Protocol

Kontrak antara `@rikology/pupitre` (server) dan `@rikology/pupitre-react` (client). Semua bentuk di sini dikunci oleh Zod di `@rikology/pupitre/catalog` dan diuji snapshot di kedua sisi. Perubahan apa pun di dokumen ini wajib menaikkan `catalogVersion`.

Format spec mengikuti `@json-render/core` 0.21 (flat `root` + `elements`, ekspresi `$state`/`$bindState`/`$cond`/`$template`/`$computed`, `visible`, `watch`, `repeat`). Pupitre tidak menambah sintaks ekspresi; `$raw` adalah wrapper escape khusus untuk sub-spec di prop descriptor, bukan ekspresi state.

## 1. Props halaman Inertia

Satu komponen page `pupitre`. Props:

```ts
type PupitrePageProps = {
  pupitre: {
    panel: { id: string; path: string; brand: Brand; theme: ThemeVars; features: PanelFeatures }
    user: { id: string | number; name: string; email: string; avatarUrl?: string; timezone?: string } | null
    tenant: { id: string | number; name: string; slug?: string } | null
    tenants?: { id: string | number; name: string; url: string }[]      // untuk switcher
    nav: NavGroup[]
    flash: { type: 'success' | 'error' | 'warning' | 'info'; title: string; body?: string }[]
    notifications?: { unread: number }                                  // detail via /_pupitre/notifications
    locale: string
    timezone: string
  }
  page: {
    key: string                        // reset store kalau berubah
    kind: 'list' | 'create' | 'edit' | 'view' | 'page' | 'dashboard' | 'auth' | 'custom'
    title: string
    breadcrumbs: { label: string; url?: string }[]
    spec: Spec                         // pohon json-render
    state: StateModel                  // state awal store
    actions: { header: ActionDescriptor[] }
    widgets?: WidgetDescriptor[]                 // dashboard / edit page
    relations?: RelationDescriptor[]             // edit/view page
    deferred?: string[]                          // nama prop yang masih deferred
    catalogVersion: string
    component?: string                           // kind 'custom': page Inertia host
  }
  data?: TableData                     // prop top-level; list page saja; partial reload `only: ['data']`
}
```

`pupitre.*` dibagikan lewat `ctx.inertia.share` oleh middleware `share_props`; `page.*` dan `data` disusun controller. `@adonisjs/inertia` 5 hanya menyaring partial reload pada nama prop **top-level** (`inertia_manager` memilih `Object.keys(props)`), karena itu data tabel adalah prop top-level `data` dan refresh tabel memakai `only: ['data']` (ADR-0011). Flash Pupitre dibaca dari session key `pupitre` ke `pupitre.flash`; kanal `flash` Inertia v3 tetap milik middleware host.

## 2. State model

| Path | Pemilik | Diisi oleh |
| --- | --- | --- |
| `/data/**` | user | `state` awal (dari `fill()`); user mengetik; `set()` handler |
| `/errors/**` | server | respons 422; dikosongkan saat submit berikutnya |
| `/meta/record` | server | snapshot record read-only (setelah transformer) |
| `/meta/dirty` `/meta/submitting` | client | bridge |
| `/ui/**` | client | komponen layout (`/ui/tabs/<id>`, `/ui/wizard/<id>/step`, `/ui/section/<id>/collapsed`) |
| `/options/<field>` | server | `fetchOptions` |
| `/modal/**` | — | store modal terpisah; struktur sama (`/modal/data`, `/modal/errors`) |

Path field mengikuti nama field di builder dengan `.` → `/` dan indeks repeater sebagai segmen: `items.0.sku` ⇔ `/data/items/0/sku`. Error VineJS yang bernama `items.0.sku` dipetakan dengan aturan yang sama. Field di dalam repeater tidak membawa prop `error`; komponen membaca `/errors/<path>` dari path binding absolut (`bindings.value`, mis. `/data/items/0/sku`) lewat hook `useFieldError` (jawaban SPIKE Q1).

## 3. Spec: konvensi elemen

- ID elemen: `f.<path>` untuk field (`f.items.sku` untuk field di dalam repeater template), `l.<n>` untuk layout, `a.<name>` untuk action di dalam form, `root` untuk `Form`/`Infolist`.
- Field selalu punya `props.name` (path tanpa prefix) dan `props.value: { $bindState: '/data/<path>' }` (atau `$bindItem` di dalam repeat), `props.error: { $state: '/errors/<path>' }`.
- Repeater: elemen `Repeater` dengan `props.descriptor: RepeaterDescriptor`, `props.value` terikat ke array (`$bindState` di level atas, `$bindItem` saat bersarang), `repeat: { statePath, key: '_key' }`, dan satu anak template `RepeaterItem` (`props.index: { $index: true }`, opsional `props.itemLabel` dievaluasi dalam scope item) yang anak-anaknya adalah field item. Tiap item di state membawa `_key` (ditambahkan compiler; item baru memakai `pushState` dengan `_key: '$id'`); VineJS membuang `_key` saat validasi. Tambah item = event `add` → `pushState`; hapus/pindah/klon/collapse dikerjakan komponen UI lewat nilai array yang terikat, karena param action json-render tidak bisa menyatakan path array induk di dalam scope repeat bersarang. Lihat [SPIKE_M0.md](./SPIKE_M0.md) §7.
- Tabs: elemen `Tabs` dengan `props.tabs` dan `props.active: { $bindState: '/ui/tabs/<id>' }`, anak-anaknya elemen `Tab` (urutan sama dengan `props.tabs`); semua panel tetap ter-mount, yang tidak aktif disembunyikan. Named slots tidak dipakai karena nama slot harus statis di catalog (SPIKE Q4).
- `watch` dipasang pada elemen field yang `.live()` dan punya `afterStateUpdated`: `{ '/data/<path>': [{ action: 'setState', params: { statePath, value: <ekspresi terangkat> } }] }`. Closure yang tidak bisa diangkat ke `setState` + `$state`/`$computed` ditolak saat compile (`E_PUPITRE_UNLIFTABLE_CLOSURE`) sampai `live({ server: true })` + `evaluate` tersedia di M3 (WP31).

Sub-spec yang tertanam di prop descriptor memakai `{ $raw: spec }` agar `$bindState`/`$template` di dalamnya tidak dievaluasi terhadap store halaman luar; renderer membuka wrapper sebelum spec diteruskan ke komponen. Hanya gunakan pada batas sub-spec, bukan pada ekspresi komponen biasa.

## 4. Action descriptor

```ts
type ActionDescriptor = {
  name: string
  label: string
  icon?: string
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'gray'
  kind: 'link' | 'direct' | 'confirm' | 'form'
  url: string                        // sudah berisi record id / query
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'   // default: link→get, lainnya→post
  enabled: boolean                   // hasil visible && can di server
  openInNewTab?: boolean
  keyBindings?: string[]
  confirm?: { heading: string; description?: string; submitLabel?: string; cancelLabel?: string; icon?: string; destructive?: boolean }
  modal?: { heading?: string; description?: string; width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'; slideOver?: boolean; submitLabel?: string; cancelLabel?: string; footerActions?: ActionDescriptor[] }
  deepLink?: boolean                 // M3
  group?: string                     // action.group()
}
```

Per-record action pada tabel dikirim di setiap `row.actions`, bukan di spec, karena `enabled` dievaluasi per record.
`keyBindings` diterapkan pada action header dan bulk; action row tidak menerima `keyBindings`.

Protokol (ADR-0012). Semua submit action berjalan lewat `fetch` JSON, bukan `router.post` Inertia, supaya satu respons bisa membawa flash, redirect, reload, atau patch:

| kind | Klik | Submit |
| --- | --- | --- |
| `link` | `router.visit(url)` (`window.open` bila `openInNewTab`) | — |
| `direct` | `fetch(url)` JSON | — |
| `confirm` | `ConfirmDialog` → `fetch(url, { ids? })` JSON | — |
| `form` | `GET url` (`Accept: application/json`) → `ActionFormResponse` → `ActionModal` | `fetch(url, { data, ids? })` JSON |

Header submit: `Accept: application/json`, `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`, `X-Pupitre-Action: 1`, `X-Pupitre-Url: <current page pathname + query>` (untuk `redirect.back()`; server hanya menerima path relatif same-origin), `X-XSRF-TOKEN` (dekode cookie `XSRF-TOKEN` Shield), `credentials: 'same-origin'`; body `{ data?, ids? }`. Route resource (`store`/`update`/`destroy`) menjawab redirect Inertia biasa, tetapi JSON bila header `X-Pupitre-Action: 1` ada — `actions.delete()` memakai route `destroy` lewat jalur yang sama.

```ts
type ActionFormResponse = { spec: Spec; state: StateModel; catalogVersion: string }
type ActionResult = {
  flash: FlashMessage[]
  redirect?: string        // redirect.back() → URL halaman saat ini; redirect.to(url)
  reload?: boolean         // refresh.table() → router.reload({ only: ['data'] }) di list page, reload penuh di tempat lain
  patch?: JsonPatchOp[]    // diterapkan ke prop `data` lalu reload `only: ['data']`
  deselect?: boolean       // deselectAfter(): kosongkan seleksi tabel
}
```

Respons action setelah submit:

- **`200 ActionResult`**: flash → toast; `redirect` → `router.visit` (URL sama → `router.reload()`); modal ditutup. Default `{ flash, redirect: <URL saat ini> }`. `refresh.table()` menghasilkan `reload: true` tanpa `patch`, karena executor action tidak memegang query tabel aktif sehingga patch yang aman tidak bisa dihitung.
- **`422 { errors: Record<field, string[]> }`** → `/errors/**` store modal (modal tetap terbuka); action tanpa modal → toast error pertama.
- **`403 { message }` / `404 { message }`** → toast error, modal tetap terbuka.

## 5. Tabel

### 5.1 Query string

| Param | Bentuk | Contoh |
| --- | --- | --- |
| `sort` | `<column>` atau `-<column>` | `sort=-createdAt` |
| `q` | string | `q=hello` |
| `page`, `perPage` | int; `perPage=all` hanya kalau diizinkan builder | `page=2&perPage=25` |
| `filters[<name>]` | nilai filter; filter form → `filters[author][authorId]=3` | `filters[status]=draft` |
| `tab` | key tab | `tab=draft` |
| `groupBy` | nama grup | `groupBy=status` |
| `<prefix>[...]` | relation manager: prefix nama relasi | `comments[sort]=-createdAt` |

Param tidak dikenal diabaikan. Sort pada kolom yang tidak `sortable()` → 400 dengan pesan. Filter pada nama yang tidak ada → diabaikan.

### 5.2 Descriptor (di spec, statis per resource)

```ts
type TableDescriptor = {
  id: string                         // dipakai untuk localStorage column toggles
  url: string                        // base URL list; bridge menambah query
  columns: ColumnDescriptor[]
  filters: FilterDescriptor[]        // tiap filter membawa sub-spec form kecil
  filtersLayout: 'dropdown' | 'above' | 'slideover'
  tabs?: { key: string; label: string; badge?: number }[]
  groups?: { key: string; label: string }[]
  defaultSort?: { column: string; direction: 'asc' | 'desc' }
  perPageOptions: (number | 'all')[]
  searchable: boolean
  searchDebounce: number
  reorderable?: { url: string }
  poll?: number                      // ms
  selectable: boolean                // ada bulk action
  bulkActions: ActionDescriptor[]    // url tanpa id; ids di body
  emptyState?: { heading: string; description?: string; icon?: string; action?: ActionDescriptor }
  layout: 'table' | 'grid'
}

type ColumnDescriptor = {
  name: string                       // 'author.name'
  label: string
  type: 'text' | 'badge' | 'icon' | 'image' | 'color' | 'toggle' | 'select' | 'textInput' | 'checkbox' | 'custom' | 'fragment'
  sortable: boolean
  searchable: boolean
  toggleable?: { hiddenByDefault: boolean }
  alignment?: 'start' | 'center' | 'end'
  wrap?: boolean
  width?: string
  props: Record<string, unknown>     // spesifik tipe: colors, limit, since, options (select), circular...
  editable?: { url: string }         // M3 only: PATCH inline edit
  summarize?: ('sum' | 'avg' | 'count' | 'min' | 'max')[]
}
```

### 5.3 Data (prop top-level `data`, dinamis)

```ts
type TableData = {
  rows: TableRow[]
  meta: { total: number; perPage: number; currentPage: number; lastPage: number; from: number; to: number }
  summary?: Record<string, Record<string, number | string>>   // column → agg → nilai terformat
  groups?: { key: string; label: string; rows: TableRow[]; summary?: ... }[]  // kalau groupBy
  query: Record<string, unknown>     // query ternormalisasi yang dipakai server (untuk sinkron UI)
}

type TableRow = {
  key: string | number
  cells: Record<string, unknown>     // name → nilai siap tampil (sudah lewat transformer + formatter server)
  actions: ActionDescriptor[]
  url?: string                       // klik baris
  selectable: boolean
}
```

Nilai cell dikirim **sudah terformat** server-side (tanggal di timezone panel, angka terlokalisasi) plus nilai mentah bila kolom editable (`cells[name] = { value, display }`).

### 5.4 Endpoint tabel

| Method & URL | Body | Respons |
| --- | --- | --- |
| `GET <list>?...` (Inertia, `only: ['data']`) | — | props (`data` saja) |
| `PATCH <list>/:id/column/:name` (M3) | `{ value }` | 204 atau 422; tidak tersedia di M1 |
| `POST <list>/reorder` | `{ ids: (string\|number)[] }` | 204 |
| `POST <list>/export` | `{ format: 'csv', columns?: string[], query }` | redirect ke download atau `{ jobId }` kalau adapter jobs ada |

## 6. Endpoint internal `/_pupitre/*`

Semua di dalam route group panel (prefix panel + tenant), middleware sama.

| Method & URL | Body/Query | Respons |
| --- | --- | --- |
| `POST /_pupitre/evaluate` | `{ resource, page, field, state: StateModel['/data'], record? }` | `{ set: Record<pointer, unknown> }` |
| `GET /_pupitre/options/:resource/:field` | `q`, `selected[]`, `page` | `{ options: { value, label, description?, disabled? }[]; hasMore: boolean }` |
| `GET /_pupitre/search` | `q` | `{ groups: { resource: string; label: string; results: { title: string; details?: string[]; url: string }[] }[] }` |
| `GET /_pupitre/notifications` | `page` | `{ items: NotificationItem[]; unread: number; meta }` |
| `POST /_pupitre/notifications/read` | `{ ids: string[] \| 'all' }` | 204 |
| `POST /_pupitre/upload` | multipart `file`, `field`, `resource`, `record?`; header `Accept: application/json`, `X-XSRF-TOKEN` | `{ key: string; url: string; name: string; size: number; mime: string }`; 403 tanpa ability `create`/`update`; 404 bila resource/field tidak dikenal; 413 bila `maxSize` terlampaui; 422 bila MIME hasil sniff byte (`file-type`) tidak sesuai `accept`/`image()` |
| `DELETE /_pupitre/upload` | `{ key, field, resource }` | 204; 403 bila key bukan unggahan sesi ini (`session` key `pupitre.uploads`) |
| `GET /_pupitre/widgets/:name` | query filters dashboard | `WidgetData` |

Setiap endpoint memvalidasi `resource`/`field` terhadap definition yang terdaftar dan menjalankan ability yang sesuai (`options` → `viewAny` model relasi, `evaluate` → `create`/`update`).

## 7. Route dan penamaan

Pola nama: `<panel>.<slug>.<page>`; route action memakai nama tetap dengan parameter `:action`. Semua masuk registry Tuyau sehingga `urlFor('admin.posts.edit', { id })` type-safe.

| URL (relatif ke panel path + `/:tenant` opsional) | Nama |
| --- | --- |
| `GET /` | `admin.dashboard` |
| `GET /posts` | `admin.posts.list` |
| `GET /posts/create` · `POST /posts` | `admin.posts.create` · `admin.posts.store` |
| `GET /posts/:id/edit` · `PUT /posts/:id` | `admin.posts.edit` · `admin.posts.update` |
| `GET /posts/:id` | `admin.posts.view` |
| `DELETE /posts/:id` | `admin.posts.destroy` |
| `GET /posts/actions/:action` · `POST /posts/actions/:action` | `admin.posts.actions` · `admin.posts.actions.store` (header & bulk) |
| `GET /posts/:id/actions/:action` · `POST /posts/:id/actions/:action` | `admin.posts.record.actions` · `admin.posts.record.actions.store` (row) |
| `POST /_pupitre/upload` · `DELETE /_pupitre/upload` | `admin.upload.store` · `admin.upload.destroy` |
| `GET /posts/:id/relations/:relation` | `admin.posts.relations.<relation>.list` |
| `GET/POST /posts/:id/relations/:relation/:rid/actions/:action` | `admin.posts.relations.<relation>.actions.<action>` |
| `GET /posts/:id/revisions/...` | `admin.posts.revisions.<page>` (nested resource) |
| `GET /settings` (custom page) | `admin.settings` |
| `GET /login`, `POST /login`, ... | `admin.auth.login`, ... |

Route action didaftarkan **sebelum** `:id` agar `/posts/actions/x` tidak tertangkap `/posts/:id`; slug action tidak boleh numerik (divalidasi builder).

## 8. Error

| Kondisi | HTTP | Perilaku client |
| --- | --- | --- |
| Validasi | 422 (Inertia errors) | `/errors/**` diisi; fokus ke field pertama; toast kalau ada error tanpa field (`_form`) |
| Tidak diizinkan | 403 | Inertia: redirect back + flash error; JSON: toast |
| Record hilang | 404 | Halaman 404 panel (shell tetap) |
| Tenant tidak valid | 404 | Halaman "tenant tidak ditemukan" tanpa shell |
| CSRF/sesi habis | 419 | Reload penuh ke login panel dengan `?redirect=` |
| `catalogVersion` client ≠ server | — | Toast "reload required" + `router.reload()` penuh |
