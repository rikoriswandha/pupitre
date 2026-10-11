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
    tenants?: { id: string | number; name: string; url: string; method?: 'get' | 'post'; current?: boolean }[] // GET tenant home or POST switch `{ tenant: id }`

    nav: NavGroup[]
    flash: { type: 'success' | 'error' | 'warning' | 'info'; title: string; body?: string }[]
    notifications?: { unread: number; url: string; readUrl: string; interval: number } // tray endpoint URLs + shared-prop polling interval
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
    widgets?: WidgetDescriptor[]                 // dashboard, custom page, resource pages
    filters?: WidgetFilter[]                     // dashboard/custom page URL filters
    relations?: RelationDescriptor[]             // edit/view page
    subNavigation?: { key: string; label: string; url: string; active?: boolean }[] // record pages
    deferred?: string[]                          // nama prop yang masih deferred
    catalogVersion: string
    component?: string                           // kind 'custom': page Inertia host
  }
  data?: TableData                     // default top-level table prop; partial reload `only: ['data']`
  [dataProp: string]: WidgetData | TableData | undefined // additional relation/widget data props
```

```ts
type NavItem = { label: string; url?: string; icon?: string; badge?: string | number; external?: boolean; active?: boolean }
type NavGroup = { label: string; items: NavItem[]; icon?: string; sort?: number; collapsible?: boolean; collapsed?: boolean }
```

`nav` difilter menurut `viewAny`, `canAccess`, dan `visible`; badge closure dievaluasi per request. `active` menunjukkan URL saat ini. Sidebar menyimpan status grup collapsible per panel dan grup di `localStorage`.

`panel.theme` adalah objek tervalidasi: variabel CSS aman (`primary`, `--radius`, `vars`), `fontFamily`/`fontUrl`, `density`, `sidebar`, `sidebarCollapsibleOnDesktop`, `contentWidth`, dan `stylesheet`. Font dan stylesheet hanya dapat ditautkan melalui URL same-origin atau HTTPS; konfigurasi tema tidak diserialisasi sebagai CSS mentah dan tidak memerlukan inline `<style>`. `sidebar: 'collapsed'` memakai icon rail; toggle desktop opsional tersimpan per panel, sedangkan `'top-nav'` merender grup navigasi sebagai dropdown. Lebar shell memakai `md` sampai `7xl`, `full`, atau `screen`.
`panel.brand.logoDark` adalah logo opsional untuk mode gelap. `panel.userMenu` berisi item yang sudah difilter oleh `visible` dan diurutkan di server; method `post` dikirim melalui Inertia visit, sedangkan `external` dibuka di tab baru.

`pupitre.*` dibagikan lewat `ctx.inertia.share` oleh middleware `share_props`; `page.*` dan prop data tabel disusun controller. `@adonisjs/inertia` 5 hanya menyaring partial reload pada nama prop **top-level** (`inertia_manager` memilih `Object.keys(props)`), karena itu tabel biasa memakai prop top-level `data` dan `only: ['data']` (ADR-0011). Tabel relation manager/widget dapat memilih prop top-level lain melalui `dataProp`; `useTable` memakai `only: [dataProp ?? 'data']`. Flash Pupitre dibaca dari session key `pupitre` ke `pupitre.flash`; kanal `flash` Inertia v3 tetap milik middleware host.

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
- Builder: elemen `Builder` membawa descriptor `{ name, blocks: { key, label, icon?, template }[], minItems?, maxItems?, reorderable, collapsible, cloneable, addLabel?, blockPickerColumns? }`, `value` terikat array, dan `repeat: { statePath, key: '_key' }`. Item state berbentuk `{ _key, type: blockKey, data: { ...fieldValues } }`; template tiap blok hanya aktif untuk `type` yang cocok dan field di dalamnya memakai `$bindItem: 'data.<field>'`. Vine memilih schema dari `type`, menolak block tak dikenal, memvalidasi `data` dengan path error seperti `content.1.data.title`, dan menghapus `_key` saat dehidrasi. Builder bersarang memakai binding nilai parent yang sama.
- Wizard: `Wizard` memiliki `props.steps` sesuai urutan anak `Step`; `props.step` mengikat indeks 0-based ke `/ui/wizard/<id>/step`. Semua anak tetap ter-mount dan hanya langkah aktif ditampilkan. `steps[].fields` memetakan field ke langkah agar error 422 berpindah ke langkah pertama yang memiliki error; tidak ada validasi per langkah di client.
- Repeater: elemen `Repeater` dengan `props.descriptor: RepeaterDescriptor`, `props.value` terikat ke array (`$bindState` di level atas, `$bindItem` saat bersarang), `repeat: { statePath, key: '_key' }`, dan satu anak template `RepeaterItem` (`props.index: { $index: true }`, opsional `props.itemLabel` dievaluasi dalam scope item) yang anak-anaknya adalah field item. Tiap item di state membawa `_key` (ditambahkan compiler; item baru memakai `pushState` dengan `_key: '$id'`); VineJS membuang `_key` saat validasi. Tambah item = event `add` → `pushState`; hapus/pindah/klon/collapse dikerjakan komponen UI lewat nilai array yang terikat, karena param action json-render tidak bisa menyatakan path array induk di dalam scope repeat bersarang. Lihat [SPIKE_M0.md](./SPIKE_M0.md) §7.
  Pada `Repeater.relationship`, setiap item state juga memuat `_relationKey` (PK child internal) untuk round-trip edit. Nilai ini bukan otorisasi: server menolak PK yang tidak ditemukan lewat query hasMany milik parent. `orderColumn` hanya konfigurasi server dan tidak masuk ke wire descriptor. Text mask mengirim/menyimpan string raw; pola mask hanya prop presentasi. `Slider.value` berupa angka atau tuple dua angka, dengan `min`, `max`, `step`, `marks`, dan `range` tervalidasi di catalog.
- Tabs: elemen `Tabs` dengan `props.tabs` dan `props.active: { $bindState: '/ui/tabs/<id>' }`, anak-anaknya elemen `Tab` (urutan sama dengan `props.tabs`); semua panel tetap ter-mount, yang tidak aktif disembunyikan. Named slots tidak dipakai karena nama slot harus statis di catalog (SPIKE Q4).
- `watch` dipasang pada elemen field yang `.live()` dan punya `afterStateUpdated`: `{ '/data/<path>': [{ action: 'setState', params: { statePath, value: <ekspresi terangkat> } }] }`. Closure yang tidak bisa diangkat ke `setState` + `$state`/`$computed` ditolak saat compile (`E_PUPITRE_UNLIFTABLE_CLOSURE`) sampai `live({ server: true })` + `evaluate` tersedia di M3 (WP31).


Input editor `MarkdownEditor` memakai string Markdown di `value`, toolbar/upload URL/preview sebagai props; attachment memakai upload endpoint field yang sama dengan `RichEditor`. `CodeEditor` mengirim string sumber dan hanya menerima bahasa dalam enum catalog. `FileUploadDescriptor` menambahkan `imageEditor?: boolean` serta `imageEditorAspectRatios?: (string | null)[]`; pemotongan, rotasi, flip, dan konversi Blob terjadi sebelum multipart upload, sementara server tetap memeriksa bytes MIME dan `maxSize`. `TextEntry` dengan `markdown: true` menerima nilai teks biasa; server mengubah Markdown menjadi HTML lalu menerapkan allowlist `sanitizeHtml`, bukan menerima HTML klien.
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
  modal?: { heading?: string; description?: string; width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'; slideOver?: boolean; submitLabel?: string; cancelLabel?: string; submit?: boolean; cancel?: boolean; footerActions?: { name: string; label: string; kind: 'link' | 'direct' | 'confirm' | 'form'; url: string; method?: 'get' | 'post' | 'put' | 'patch' | 'delete'; enabled: boolean }[] }
  deepLink?: boolean
  group?: string                     // action.group()
}
```

Per-record action pada tabel dikirim di setiap `row.actions`, bukan di spec, karena `enabled` dievaluasi per record.
`keyBindings` diterapkan pada action header dan bulk; action row tidak menerima `keyBindings`.
Action yang `.deepLinkable()` membuka/mengganti query dengan `?action=<name>` dan opsional `&record=<id>`; menutup modal menghapus kedua param tanpa navigasi. Saat halaman dimuat, client hanya membuka descriptor yang ada dan `enabled`; untuk action row, `record` harus cocok dengan key row, sedangkan header action di edit/view menggunakan ID record pada descriptor dan endpoint GET/POST action. GET form tetap memeriksa otorisasi resource, record, dan ability action di server, sehingga descriptor lama tidak melewati policy.
Footer action modal adalah tombol tambahan: aksi `link` menavigasi; aksi lain mengirim data modal saat ini bersama `ids` ke URL action-nya. `modal.submit` dan `modal.cancel` default `true`; nilai `false` menyembunyikan tombol terkait.

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
- **`429 { message, retryAfter }`** → toast error; limiter menghitung percobaan per panel/action dan user atau IP.

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
Pencarian per kolom menggunakan `columns[<name>][search]`; hanya kolom `.searchable({ individually: true })` yang diproses. `groupBy` memilih grup terdaftar. `.softDeletes()` menambahkan mode `filters[trashed]=without|with|only`; tanpa parameter query mengecualikan record terhapus.
Ringkasan `.summarize()` dihitung sebagai agregat SQL pada query yang sudah menerapkan scope resource/tenant, filter, pencarian, tab, dan soft-delete. Saat `groupBy` aktif, ringkasan dihitung per grup dengan `GROUP BY` (relasi memakai subquery relasi Lucid); hanya halaman baris yang dimuat untuk dirender.

### 5.2 Descriptor (di spec, statis per resource)

```ts
type TableDescriptor = {
  id: string                         // dipakai untuk localStorage column toggles
  url: string                        // base URL tabel; bridge menambah query
  dataProp?: string                   // top-level TableData prop, default `data`
  queryPrefix?: string                // URL namespace `<prefix>[sort]`, `<prefix>[filters][x]`, dst.
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
  gridColumns?: { default?: number; md?: number; xl?: number }
  deferFilters?: boolean             // filter draft baru dikirim saat Apply
  deferLoading?: boolean             // prop `data` ditunda oleh Inertia
}

type ColumnDescriptor = {
  name: string                       // 'author.name'
  label: string
  type: 'text' | 'badge' | 'icon' | 'image' | 'color' | 'toggle' | 'select' | 'textInput' | 'checkbox' | 'custom' | 'fragment'
  sortable: boolean
  searchable: boolean
  individuallySearchable?: boolean  // UI input di header; query nested columns[<name>][search]
  toggleable?: { hiddenByDefault: boolean }
  alignment?: 'start' | 'center' | 'end'
  wrap?: boolean
  width?: string
  props: Record<string, unknown>     // spesifik tipe: colors, limit, since, options (select), circular...
  editable?: { url: string }         // PATCH inline edit; enabled record scoped
  summarize?: ('sum' | 'avg' | 'count' | 'min' | 'max' | 'range')[]
}
```
Relation managers pada `page.relations` memakai descriptor berikut; tiap manager memiliki top-level prop data sendiri dan namespace query yang diparse server sebelum parameter tabel diproses.

```ts
type RelationDescriptor = {
  key: string
  relation: string
  label: string
  group?: string
  icon?: string
  badge?: string | number
  url: string
  dataProp: string
  queryPrefix: string
  readOnly: boolean
  table: TableDescriptor
  actions: { header: ActionDescriptor[]; row: ActionDescriptor[]; bulk: ActionDescriptor[] }
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
  className?: string                  // rowClass server-evaluated; hanya token class aman
  selectable: boolean
}
```

Nilai cell dikirim **sudah terformat** server-side (tanggal di timezone panel, angka terlokalisasi) plus nilai mentah bila kolom editable (`cells[name] = { value, display }`).

Untuk kolom inline-edit, `cells[name]` berisi `{ value, display, disabled? }`; `value` dipakai saat submit, `display` adalah teks siap tampil. UI memperbarui nilai optimistis lalu mengembalikan nilai lama dan menampilkan toast bila PATCH gagal.

### 5.3.1 Interaksi tabel M3

- `poll` adalah interval milidetik; UI hanya reloads `dataProp` saat tab aktif dan tidak ada dialog/modal atau editor teks aktif.
- Kolom `.toggleable({ hiddenByDefault })` disimpan per `descriptor.id` pada `localStorage`; akses storage hanya di browser.
- `layout: 'grid'` merender kartu dengan selection, URL record, aksi, dan jumlah kolom responsif dari `gridColumns`.
- `.deferFilters()` menyimpan perubahan lokal hingga Apply.
- `.reorderable(column)` mengurutkan awal menurut kolom tersebut. UI menyediakan mode reorder dengan drag handle dan tombol pindah atas/bawah.

### 5.4 Endpoint tabel

| Method & URL | Body | Respons |
| --- | --- | --- |
| `GET <list>?...` (Inertia, `only: ['data']`) | — | props (`data` saja) |
| `PATCH <list>/:id/column/:name` (M3) | `{ value }` | 204; 400 body invalid; 403 unauthorized; 404 record/column unavailable; 422 `{ errors }` |
| `POST <list>/reorder` | `{ ids: (string\|number)[] }` | 204; 400 IDs invalid; 403 update/reorder denied; 404 ID outside scope |
| `POST <list>/export` | `{ columns?: string[], ids?: (string\|number)[] }`; query tabel aktif (termasuk nested filters/column search, prefix dan trashed mode) dari `X-Pupitre-Url` diproses melalui `parseTableParams` | `text/csv` hingga `exports.maxSyncRows`; ekspor lebih besar dengan jobs: `{ jobId, progressUrl, downloadUrl }`; tanpa jobs: 413 limit |
| `POST <list>/import/preview` | multipart `file` CSV | `{ headers: string[], preview: Record<string,string>[], fields: { name, label, required }[] }` (`importPreviewResponse`) |
| `POST <list>/import` | multipart `file` + `mapping: Record<CSV header, form field>` (nilai `''` berarti Skip dan diabaikan) | `{ total, created, updated, failed, failedRowsUrl? }` (`importResultResponse`); bila `.async()` + jobs, `{ jobId, progressUrl }` (`importJobResponse`) lalu hasil tersedia pada progress endpoint |
Ekspor di bawah atau sama dengan `exports.maxSyncRows` (default 1.000) berjalan sinkron; lebih besar akan diantrekan bila jobs tersedia, hingga `exports.maxAsyncRows` (default 100.000). Ekspor menghormati query dari `X-Pupitre-Url` (q, sort, nested filters/column search, tab, prefix, termasuk filter soft-delete) dan formatter server; kolom default adalah kolom tabel yang tampak. Tanpa adapter jobs, ekspor di atas batas sinkron menghasilkan 413.

Jobs memakai handler bernama tetap yang didaftarkan saat boot (`pupitre.export`, `pupitre.import`, `pupitre.bulk`). Payload queue hanya membawa identitas serializable—panel/resource/action, IDs, user/tenant, IDs progress, storage key, mapping, serta query options—bukan closure request atau isi hasil ekspor. Worker memuat ulang definisi, identitas dan record melalui `scopedQuery`. Handler aksi menerima job context (`ctx.pupitre`, `ctx.params`), bukan response/session HTTP; jangan mengandalkan request HTTP atau upload temporer.

Impor membaca header CSV lalu menampilkan pemetaan ke field scalar dari form resource. Mapping dikirim sebagai multipart field JSON; setiap row divalidasi oleh VineJS dari definisi form, dibuat atau diperbarui lewat `actions.import().resolveRecord(...)`, dan transaksi dipisah per row. Respons merangkum `total/created/updated/failed`; `failedRowsUrl` mengunduh CSV dengan kolom `Errors`.

PATCH membutuhkan autentikasi, otorisasi resource/record `update`, CSRF, dan query record melalui `scopedQuery`; record lintas tenant menghasilkan 404. Nama kolom yang tidak ada/tidak editable menghasilkan 404, body invalid 400, nilai tidak valid 422 `{ errors }`, dan update sukses 204. Single-field rules untuk `textInput` dikompilasi melalui Vine compiler yang sama. Operasi inline edit berjalan dalam transaksi dan sengaja tidak memanggil `beforeSave`/`afterSave` resource hook; hook tersebut tetap khusus operasi form resource penuh.

Reorder hanya menerima ID unik milik scope resource. `reorder` policy ability dicoba per record; jika tidak diizinkan digunakan fallback ability `update`. Seluruh penulisan urutan dilakukan dalam satu transaksi. Route POST dilindungi CSRF.

## 6. Endpoint internal `/_pupitre/*`

Semua di dalam route group panel (prefix panel + tenant), middleware sama.

| Method & URL | Body/Query | Respons |
| --- | --- | --- |
| `POST /_pupitre/evaluate` | `{ resource, page: 'create'|'edit'|'page', field, state: Record<string, unknown>, record? }` | `{ set: Record<pointer, unknown> }`; closure berjalan server-side dan hanya dapat menulis field form yang ada/non-hidden/non-disabled |
| `GET /_pupitre/options/:resource/:field` | `q`, `selected[]`, `page` | `{ options: Option[]; hasMore: boolean }` (`optionsResponse` Zod); page size 20, selected IDs are returned with labels |
| `GET /_pupitre/options/:resource/:field?create=1` | — | `ActionFormResponse` for the field's `createOptionForm` |
| `POST /_pupitre/options/:resource/:field` | `{ data }` | `{ option: Option }`; 422 validation, 403 related-model `create` denial |
| `GET /_pupitre/search` | `q` | `{ groups: { resource: string; label: string; results: { title: string; details?: string[]; url: string }[] }[] }` |
| `GET /_pupitre/notifications?page=` | — | `{ items: NotificationItem[]; unread: number; meta: { total, perPage, currentPage, lastPage } }`; default page 1, 20 items/page; adapter + panel notifications required, otherwise 404 |
| `POST /_pupitre/notifications/read` | `{ ids: string[] \| 'all' }` | 204; only affects the authenticated user's notifications; 404 when notifications are disabled |
| `POST /_pupitre/upload` | multipart `file`, `field`, `resource` (slug pemilik form: resource atau custom page), `record?`; header `Accept: application/json`, `X-XSRF-TOKEN` | `{ key: string; url: string; name: string; size: number; mime: string }`; 403 tanpa ability resource atau `canAccess` page; 404 bila pemilik/field tidak dikenal; 413 bila `maxSize` terlampaui; 422 bila MIME hasil sniff byte (`file-type`) tidak sesuai `accept`/`image()` |
| `DELETE /_pupitre/upload` | `{ key, field, resource }` | 204; 403 bila key bukan unggahan sesi ini (`session` key `pupitre.uploads`) |
| `GET /_pupitre/exports/:id` | — | `{ id, status: queued\|processing\|done\|failed, totalRows, processedRows, createdRows?, updatedRows?, failedRows?, failedRowsUrl?, error?, downloadUrl? }`; pemilik user + tenant, dan ability `viewAny` (import memakai `create`) |
| `GET /_pupitre/exports/:id/download` | — | stream CSV privat; hanya pemilik user + tenant dan ability resource |
| `GET /_pupitre/widgets/:name` | filter dashboard `filters[<key>]`; tabel widget memakai prefix nama widget; widget resource mengirim `resource=<slug>&widgetPage=list\|create\|edit\|view`, ditambah `record=<id>` untuk edit/view dan `parentId=<id>` untuk resource nested; widget custom page mengirim `customPage=<slug>` | `WidgetData`; endpoint memeriksa ability resource, akses parent nested, `canAccess` custom page, dan `canView` widget; record dicari via `scopedQuery` dan diperiksa ability view/update sesuai `widgetPage` |

`WidgetDescriptor` membawa `{ name, kind, dataProp, dataUrl, heading?, description?, span, sort, poll?, placement?, chartType?, component?, table? }`. `dataUrl` adalah URL panel-scoped untuk `GET /_pupitre/widgets/:name`; klien mengirim query filter saat polling atau refresh. URL menyertakan konteks resource/custom page di atas; widget record wajib memakai `widgetPage` eksplisit. Parameter `widgetPage` terpisah dari `page` agar pagination tabel tidak menimpa konteks widget.


`NotificationItem` adalah `{ id, type: 'success'|'error'|'warning'|'info', title, body?, url?, actions?: { label, url?, method?: 'get'|'post', markAsRead? }[], readAt: string|null, createdAt: string }`. Flash message memakai bentuk action yang sama; tray/toast merender action dan `markAsRead` menandai item dibaca saat tombol tersebut diklik. `notificationListResponse` dan `notificationsReadRequest` di `@rikology/pupitre/catalog` memvalidasi kontrak endpoint ini. Kedua route berada di tenant route group dan bernama `<panel>.notifications` dan `<panel>.notifications.read`.

Tenancy routes live under the panel user route group (without a tenant segment): `GET <panel.path>` redirects to the first authorized tenant home in mode `url`; `POST <panel.path>/_pupitre/tenant` accepts `{ tenant: id }`, persists the current tenant in mode `implicit`, and redirects to the panel home. Tenant resource routes use `<panel.path>/:tenant/...` in mode `url`; tenant membership failures and unknown slugs return 404. In mode `implicit`, a missing current tenant selects and persists the first membership before continuing; users with no membership receive 403.

Setiap endpoint memvalidasi `resource`/`field` terhadap definition yang terdaftar dan menjalankan ability yang sesuai: `options` mewajibkan akses `create` atau `update` pada form owner (resource atau page melalui `findFormOwner`) serta `viewAny` pada model relasi; `evaluate` mewajibkan `create`/`update`.
Body `state` hanya berisi `/data` milik form saat ini; server tidak menerima spec atau record snapshot dari client. Resource create memerlukan ability `create`; edit mencari record lewat `scopedQuery()` lalu memerlukan `update` pada record. Custom page memeriksa `canAccess`. `field` harus cocok dengan `afterStateUpdated` field yang `live({ server: true })`; setter repeater mendapat state relatif item dan mengembalikan pointer absolut termasuk indeks. Respons Zod `evaluateResponse` berbentuk `{ set }`. Action-modal forms tidak didukung sebagai owner: store modal terpisah dan tidak mempunyai resource/page form yang stabil.

`GET /_pupitre/search` menerima query minimal dua karakter (setelah trim) dan mengembalikan `globalSearchResponse` dari `@rikology/pupitre/catalog`:

```ts
type GlobalSearchResponse = {
  groups: {
    resource: string
    label: string
    results: { title: string; details?: string[]; url: string }[]
  }[]
}
```

Setiap grup memuat hasil resource yang diizinkan `viewAny`; setiap record hanya disertakan bila ability `view` atau `update` mengizinkan navigasi ke URL halaman yang tersedia. Maksimal lima hasil per resource, dengan query yang tetap memakai scope resource dan tenant aktif.

## 7. Route dan penamaan

Pola nama: `<panel>.<slug>.<page>`; route action memakai nama tetap dengan parameter `:action`. Semua masuk registry Tuyau sehingga `urlFor('admin.posts.edit', { id })` type-safe.

| URL (relatif ke panel path + `/:tenant` opsional) | Nama |
| --- | --- |
| `GET /` (user group, mode `url`) | `admin.tenant.home` |
| `POST /_pupitre/tenant` (user group, mode `implicit`) | `admin.tenant.switch` |
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
| `GET/POST/DELETE /posts/:id/relations/:relation/actions/:action` · `GET/POST/DELETE /posts/:id/relations/:relation/:rid/actions/:action` | `admin.posts.relations.<relation>.actions.<action>` / `.store` / `.destroy` |
| `GET /posts/:id/revisions/...` | `admin.posts.revisions.<page>` (nested resource; child queries remain scoped to `:id`) |
| `GET /settings` · `POST /settings` (custom page with form + save) | `admin.settings` · `admin.settings.store` |
| `GET /settings/actions/:action` · `POST /settings/actions/:action` | `admin.settings.actions` · `admin.settings.actions.store` (custom page header action) |

| `GET /login` · `POST /login` · `POST /logout` | `admin.auth.login` · `admin.auth.login.store` · `admin.auth.logout` |
| `GET /password/forgot` · `POST /password/email` · `GET/POST /password/reset/:token` | `admin.auth.password.request` · `admin.auth.password.email` · `admin.auth.password.reset` · `admin.auth.password.update` |
| `GET/POST /register` | `admin.auth.register` · `admin.auth.register.store` |
| `GET /email/verify/:id/:hash` · `GET /email/verify` · `POST /email/verification-notification` | `admin.auth.verification.verify` · `admin.auth.verification.notice` · `admin.auth.verification.send` |
| `GET /auth/:provider/redirect` · `GET /auth/:provider/callback` (guest; only configured providers) | `admin.auth.social.redirect` · `admin.auth.social.callback` |
| `GET /profile` · `PUT /profile` (profile penuh atau halaman keamanan MFA/passkey) · `POST/DELETE /profile/avatar` (avatar aktif) | `admin.profile` · `admin.profile.update` · `admin.profile.avatar.upload` · `admin.profile.avatar.delete` |
| `GET/POST /mfa/challenge` | `admin.auth.mfa.challenge` · `admin.auth.mfa.verify` |
| `POST /profile/mfa/setup|confirm|disable|recovery-codes` | `admin.profile.mfa.*` (MFA enabled panels, independen dari `.profile()`) |
| `GET /passkeys/login/options` · `POST /passkeys/login/verify` | `admin.auth.passkeys.login.options` · `admin.auth.passkeys.login.verify` |
| `GET /profile/passkeys` · `POST /profile/passkeys/register/options|verify` · `PATCH/DELETE /profile/passkeys/:id` | `admin.profile.passkeys` · `admin.profile.passkeys.register.*` · `admin.profile.passkeys.rename` · `admin.profile.passkeys.delete` (passkeys enabled panels, independen dari `.profile()`) |
`POST /profile/mfa/setup` returns `{ secret, qrCode }` (QR data URL; enrollment secret is held in the session for ten minutes); `/confirm` accepts `{ code }` and returns recovery codes once. `/disable` accepts `{ current_password }` or `{ code }`; `/recovery-codes` accepts `{ code }` and returns replacements once. Login completion stores a five-minute pending marker with a maximum of five failed attempts; the marker is invalidated at the cap and the user must authenticate again. Limiter keys are user-specific; the session attempt cap remains active without the optional limiter package. `.mfa({ required: true })` gates protected panel routes to the registered profile/security page until enrollment completes. Email MFA is not part of v1.

Passkey registration options return the SimpleWebAuthn creation options; verification accepts `{ name, credential }` and returns `{ credentialId }` on success. Usernameless login uses the SimpleWebAuthn request options and accepts `{ credential }`; a valid assertion completes login directly only when MFA is not enabled for the panel or user verification succeeded. Otherwise MFA-enabled users continue to the challenge. Assertions update authenticator counter and `last_used_at`, and cannot replay the consumed session challenge. Passkey routes are available only when `.passkeys()` is enabled; if `@simplewebauthn/server` is absent, using them raises `E_PUPITRE_MISSING_PEER`.

The profile embeds the built-in `View` component `PupitreProfileSecurity` when MFA or passkeys are enabled. Its props are the panel base path, the current MFA-enabled state, and the passkeys feature flag; the component uses same-origin, CSRF-protected JSON requests for enrollment and management, and loads `@simplewebauthn/browser` only when registration is started. Passkey list responses expose `id`, `name`, `created_at`, and `last_used_at`; credential material remains server-side.

Route auth hanya didaftarkan saat fitur terkait diaktifkan pada panel. Login dan halaman guest forgot/reset/register mengalihkan user yang sudah login ke dashboard panel; `redirect` hanya menerima path relatif satu-origin (`/…`, bukan `//host`). Request halaman terlindungi yang kehilangan sesi mendapat redirect ke `/login?redirect=<path>`, sedangkan request JSON atau `X-Pupitre-Action: 1` mendapat HTTP 401. Login gagal kembali dengan error pada field `email`; forgot-password memberi respons yang sama untuk email dikenal/tidak dikenal. Token reset mentah hanya dikirim lewat mail adapter, tersimpan sebagai SHA-256, terikat guard, kedaluwarsa menurut `auth.passwordResetTtl` menit dan hanya dapat dipakai sekali.

`GET /email/verify` merender form resend; signed URL verifikasi menetapkan kolom `emailVerifiedAt`. Selama belum terverifikasi, user group dialihkan ke notice kecuali route verification/logout. Profil menerima `name`, `email`, `current_password`, `password`, dan bila avatar aktif `PUT /profile` menerima key avatar yang diunggah pada sesi ini. Upload avatar memakai `POST /profile/avatar` multipart `{ file, field: 'avatar', resource: 'profile', record: <user id> }` (maksimum 5 MiB; MIME gambar diverifikasi dari bytes); `DELETE` hanya menghapus unggahan sesi yang sama. File avatar baru disimpan lewat disk storage Pupitre dan file lama dihapus setelah penyimpanan user berhasil.

Untuk custom page dengan `.component('admin/Reports')`, controller merender nama komponen Inertia host tersebut dan mengirim `pupitre` shared props serta `page` (`kind: 'custom'`, `component`, `spec`, `state`, breadcrumbs, actions). Komponen host dapat memakai `<PupitreShell registry={registry}>...</PupitreShell>` dari `@rikology/pupitre-react`; tanpa escape hatch, `Pupitre` merender `spec` custom page di shell standar.

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
