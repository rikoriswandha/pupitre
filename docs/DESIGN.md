# Pupitre — Design Doc v0

Filament-like admin panel untuk AdonisJS v7 + Inertia React

Oct 10, 2026 · @Riko

## Ringkasan & keputusan

Pupitre adalah admin panel untuk AdonisJS v7 + Inertia React dengan feature parity ke Filament v4, dibangun di atas json-render sebagai wire format. Developer mendeklarasikan resource di server dengan builder chaining; server mengompilasinya ke spec json-render; satu page Inertia generik merendernya dengan komponen shadcn.

Tiga prinsip:

1. Server adalah sumber kebenaran: schema, validasi (VineJS), otorisasi (Bouncer), query (Lucid).
2. json-render memiliki pohon dan reaktivitas; Pupitre memiliki semantik domain lewat komponen "gemuk" di catalog (DataTable, Repeater, RelationManager, ActionModal, FileUpload).
3. Yang developer sentuh hanya builder API dan komponen UI yang mereka salin lewat shadcn registry. Format spec adalah detail internal.

| Area | Keputusan |
| --- | --- |
| Nama | pupitre (Prancis: meja kendali). npm `@rikology/pupitre*`, unscoped `pupitre` tersedia |
| Lisensi & cara kerja | MIT, open source; dogfood di beberapa project internal |
| Scope v1 | Full Filament v4 parity: panel, resource, form, table, infolist, actions, relation manager, nested resource, custom page, widgets, notifications, global search, tenancy, auth lengkap (login, register, reset, profile, MFA TOTP, passkeys, social login via Ally) |
| Wire format | Spec json-render langsung, dikunci setelah spike (Repeater + state bertahan saat Inertia reload) |
| Reaktivitas | Client-first; `watch` ke server hanya kalau opt-in (`.live({ server: true })`) |
| Validasi | Server-only: rules builder → VineJS; error kembali via Inertia |
| Action & modal | Client-rendered; spec form di-fetch lazy `GET .../actions/:name`, submit `POST` ke URL sama |
| State tabel | URL query (shareable, back-button) |
| Tenancy | Tenant-di-URL dan tenant-implisit, dikonfigurasi per panel; driver resmi di atas @rikology/adonisjs-tenant (optional peer); kolom `tenant_id` |
| Otorisasi | Bouncer di core; roles/permissions sebagai plugin resmi (`pupitre-shield`) |
| Discovery | Konvensi `app/admin/**`, auto-index via hook `adonisrc.ts` |
| Jobs & realtime | Interface adapter dengan driver resmi: jobs via @adonisjs/queue, notifikasi via @rikology/adonisjs-notifications (optional peer), realtime polling default + Transmit via plugin |
| Custom page | Berbasis spec via builder |
| Inertia & SSR | Inertia v3 (`@adonisjs/inertia` 4); tanpa SSR di v1, renderer SSR-safe |
| API style | Chaining, nama konvensi Adonis/VineJS: `text('name').required()`, `defineResource()` |
| Distribusi FE | Runtime via npm; komponen UI via shadcn registry, `-ui` npm sebagai default |
| Ace | `install`, `make:resource` (introspeksi model; `--from-migration` untuk tipe dari migrasi), `make:page`, `make:widget`, `make:relation-manager`, `make:plugin` |
| Bahasa | Inggris saja di v1; i18n belakangan |
| Stack | Node 24, Lucid (PostgreSQL + SQLite), Tailwind v4, shadcn/ui di atas Base UI (default shadcn sejak Juli 2026), TanStack Table, Recharts, Flydrive |

Keputusan tambahan setelah audit package `@rikology/adonisjs-*` yang sudah ada di npm:

| Area | Keputusan |
| --- | --- |
| Package sendiri yang dipakai | `adonisjs-tenant`, `adonisjs-notifications`, `adonisjs-audit-trail` sebagai optional peer di balik interface Pupitre; `adonisjs-cloudinary` sebagai opsi disk `fileUpload` |
| Field/column `custom` | Dua bentuk: komponen React host di registry, atau `fragment()` sub-schema deklaratif |
| Framework FE | React dulu; Vue/Svelte lewat renderer json-render lain setelah 1.0, kontrak catalog framework-agnostic di `pupitre/catalog` |
| Modal deep-linkable | Opt-in `.deepLinkable()` per action, M3 |
| Auth bawaan | TOTP + recovery codes, passkeys (WebAuthn), social login via `@adonisjs/ally` |
| Import/export | CSV saja di v1 |
| Theming | CSS variables shadcn + theme file per panel (font, density, sidebar style) |
| Testing | Helper Japa (`visitResource`, `submitForm`, `runAction`, assert spec) + fixture Playwright untuk `pupitre-ui` |
| Audit log | Plugin `pupitre-audit`: UI timeline di atas `adonisjs-audit-trail` |
| Repo & domain | `rikoriswandha/pupitre`, `pupitre.rikology.com` |

Dua keputusan terakhir: tooling monorepo **npm workspaces** (bukan pnpm), dan **timezone**: semua `dateTime` disimpan UTC (Luxon `DateTime`), ditampilkan dan di-parse di timezone panel (`.timezone('Asia/Jakarta')`, default dari `config/app.ts`), dengan override per user bila model user punya kolom `timezone`; komponen bisa menimpa lewat `.timezone()` sendiri seperti Filament. Cache compiled schema dikunci `panel:resource:page:locale:hash(closure)`, tidak per tenant; closure yang bergantung `ctx`/`tenant` dievaluasi per request dan ditambal ke spec hasil cache.

## Struktur package

Satu monorepo npm workspaces (konsisten dengan adonisjs-periscope) `rikoriswandha/pupitre`, empat package inti dan plugin resmi terpisah. Garis batasnya: `pupitre` tidak tahu React, `pupitre-react` tidak tahu Lucid, `pupitre-ui` hanya berisi komponen yang boleh disalin orang.

| Package | Tanggung jawab | Dependensi utama | Dikirim via |
| --- | --- | --- | --- |
| `@rikology/pupitre` | Builder API, resource, panel, router, compiler → spec, VineJS compiler, Bouncer mapping, tenancy, adapters, ace commands | @adonisjs/core, lucid, inertia, bouncer, vinejs, flydrive, @json-render/core (types) | npm |
| `@rikology/pupitre-react` | Runtime client: page generik `Pupitre`, Inertia bridge, action handlers, state store, hooks; kontrak catalog diimpor dari core (@rikology/pupitre/catalog) | react, @inertiajs/react 3, @json-render/core, @json-render/react, zod | npm |
| `@rikology/pupitre-ui` | Implementasi default semua komponen catalog (field, column cell, layout, modal, widget, shell) | shadcn/ui (Base UI), @base-ui-components/react, tailwind 4, @tanstack/react-table, recharts, tiptap, lucide | npm + shadcn registry (`registry.json` di repo yang sama) |
| `@rikology/pupitre-shield` | Roles & permissions, UI pengelolaannya, sinkron ke Bouncer | pupitre | npm (plugin resmi pertama) |
| `@rikology/pupitre-transmit` | Adapter push tabel/notifikasi via @adonisjs/transmit; client di subpath `/client` | pupitre, optional peers @adonisjs/transmit dan @adonisjs/transmit-client | npm (plugin) |
| `@rikology/create-pupitre-plugin` | Template package plugin (dijalankan oleh `make:plugin --package [--dir]`; tanpa flag menghasilkan plugin lokal) | — | npm |

Tambahan: `@rikology/pupitre-audit` (plugin, UI di atas `adonisjs-audit-trail`). Driver untuk package pihak ketiga dan package `@rikology/adonisjs-*` tidak jadi package terpisah; mereka subpath di core (`@rikology/pupitre/drivers/tenant`, `/drivers/notifications`, `/drivers/queue`, `/drivers/audit`) dengan optional peer dependency, sehingga `pupitre` tetap satu install dan host hanya memasang peer yang dipakai. Kontrak catalog (Zod) juga di core, subpath `@rikology/pupitre/catalog`, supaya renderer Vue/Svelte nanti memakai kontrak yang sama tanpa bergantung pada `pupitre-react`.

Layout host app setelah `node ace add @rikology/pupitre`:

```
app/admin/
  panels/admin.ts            # definePanel()
  resources/post_resource.ts # defineResource()
  pages/settings_page.ts     # definePage()
  widgets/stats_widget.ts    # defineWidget()
  relation_managers/
config/pupitre.ts            # global: path prefix, adapters, auth
inertia/pages/pupitre.tsx    # satu page generik, dibuat saat install
inertia/admin/registry.ts    # catalog → komponen (default: pupitre-ui)
inertia/components/pupitre/  # hasil `shadcn add`, opsional
.adonisjs/server/admin.ts    # barrel hasil auto-index (generated)
```

Satu catatan desain: `pupitre-react` hanya mengekspor kontrak Zod dan runtime, tidak pernah JSX komponen visual. Dengan begitu bundle host app hanya berisi komponen yang benar-benar dipakai, dan orang yang menyalin komponen lewat registry tidak dobel dengan versi npm.

## Builder API: Panel

Satu app bisa punya banyak panel; tiap panel punya path, guard, tenancy, dan set resource sendiri. Padanan `PanelProvider` Filament, tapi berbentuk `definePanel()` di `app/admin/panels/*.ts`.

```ts
// app/admin/panels/admin.ts
import { definePanel, nav } from '@rikology/pupitre'
import { resources, pages, widgets } from '#adonisjs/server/admin'

export default definePanel('admin')
  .path('/admin')
  .guard('web')                       // guard @adonisjs/auth
  .middleware(['auth', 'admin-only'])  // named middleware host app
  .login().registration().passwordReset().profile().mfa()
  .tenancy({
    model: () => import('#models/tenant'),
    mode: 'url',                       // 'url' → /admin/:tenant/..., 'implicit' → dari user
    ownership: 'tenant_id',            // kolom scope default
    menu: true,                        // switcher tenant di sidebar
  })
  .resources(resources)                // dari barrel auto-index, bisa difilter
  .pages(pages)
  .widgets(widgets)
  .navigation([
    nav.group('Content').items(['posts', 'categories']).sort(10),
    nav.group('Settings').collapsible().items(['settings-page']),
    nav.item('Docs').url('https://docs.example.com').external(),
  ])
  .globalSearch({ keyBinding: 'mod+k' })
  .notifications({ driver: 'polling', interval: 30_000 })
  .plugins([shield({ userModel: () => import('#models/user'), superAdminRole: 'super_admin' })])
  .brand({ name: 'Acme', logo: '/logo.svg', favicon: '/favicon.ico' })
  .theme({ primary: 'violet', darkMode: 'system' })
```

Yang dihasilkan panel saat boot:

- Route group `/admin` (plus `/:tenant` kalau mode `url`) dengan nama `admin.<resource>.<page>` dan `admin.<resource>.actions.<name>`, type-safe lewat `urlFor` v7.
- Middleware stack: Inertia share (user, tenant, nav, flash, notifications), tenancy resolver, Bouncer context.
- Satu halaman Inertia `pupitre` untuk semua route; yang berubah hanya `page` prop (`kind`, spec, data).

Perbedaan sengaja dari Filament: tidak ada `->discoverResources()` dengan path scan di runtime. Discovery terjadi saat build lewat hook `adonisrc.ts`, hasilnya barrel bertipe, panel hanya menerima array. Lebih cepat, dan error muncul saat compile.

## Builder API: Resource & Pages

Resource = satu model Lucid + form + table + infolist + actions + pages. Bentuknya `defineResource()` yang mengembalikan objek bertipe; model diinferensi sehingga nama kolom di `text('title')` dicek terhadap kolom model.

```ts
// app/admin/resources/post_resource.ts
import { defineResource, schema, table, actions, pages } from '@rikology/pupitre'
import Post from '#models/post'

export default defineResource(Post)
  .slug('posts')
  .label('Post').pluralLabel('Posts')
  .icon('file-text')
  .navigation({ group: 'Content', sort: 1, badge: (ctx) => Post.query().where('status', 'draft').count() })
  .recordTitle('title')
  .globallySearchable(['title', 'slug'])
  .policy(PostPolicy)                       // Bouncer; default: cari <Model>Policy
  .scope((query, ctx) => query.where('tenant_id', ctx.tenant.id)) // default dari tenancy panel
  .softDeletes()
  .form((s) => s.components([...]))
  .table((t) => t.columns([...]).filters([...]))
  .infolist((s) => s.entries([...]))
  .actions({
    header: [actions.create()],
    row: [actions.edit(), actions.view(), publish],
    bulk: [actions.delete()],
  })
  .relations([CommentsRelationManager])
  .nested([revisions])                      // nested resource: /posts/:id/revisions
  .pages({
    list: pages.list().tabs({ all: {}, draft: { where: { status: 'draft' } } }),
    create: pages.create().redirectTo('edit'),
    edit: pages.edit().widgets([PostStatsWidget]),
    view: pages.view(),
  })
```

Siklus request satu record (Create/Edit):

1. `GET` → policy `create`/`update` → `fill()` (mutasi data sebelum masuk form, padanan `mutateFormDataBeforeFill`) → compile schema → render.
2. `POST/PUT` → policy → compile schema ke VineJS → validate → `save()` hooks (`beforeSave`, `afterSave`, transaksi otomatis) → redirect + flash.
3. Error validasi dikirim Inertia sebagai `errors` dengan path field (`items.0.sku`), dipetakan ke state `/errors`.

Hook yang tersedia per resource, semua menerima `ctx: HttpContext` sebagai argumen terakhir: `fill`, `mutateBeforeCreate`, `mutateBeforeSave`, `beforeCreate`, `afterCreate`, `beforeSave`, `afterSave`, `beforeDelete`, `afterDelete`.

Page bawaan bisa diganti: `pages.edit().component('admin/CustomEdit')` merender page Inertia milik host sebagai escape hatch, dengan `spec` dan `record` tetap dikirim sebagai props.

## Builder API: Schema (Form, Infolist, layout, reaktivitas)

Satu builder `schema` untuk form dan infolist, mengikuti Filament v4 yang menyatukan keduanya. Komponen datang dari `schema` namespace, nama mengikuti VineJS (`text`, `number`, `select`), bukan `TextInput.make`.

```ts
import { schema as s } from '@rikology/pupitre'

.form((f) => f.components([
  s.section('Content').columns(2).components([
    s.text('title').required().maxLength(200)
      .live().afterStateUpdated(({ set, state }) => set('slug', slugify(state))),
    s.text('slug').required().unique({ ignoreRecord: true }),
    s.richEditor('body').columnSpan('full').toolbar(['bold', 'link', 'image']),
  ]),
  s.tabs([
    s.tab('Publishing').components([
      s.select('status').options({ draft: 'Draft', published: 'Published' }).live(),
      s.dateTime('publishedAt').visible(({ get }) => get('status') === 'published'),
      s.select('categoryId').relationship('category', 'name').searchable().createOption(CategoryForm),
    ]),
    s.tab('Media').components([
      s.fileUpload('cover').disk('s3').image().maxSize('2mb'),
    ]),
  ]),
  s.repeater('items').schema([
    s.text('sku').required(),
    s.number('qty').min(1).live(),
    s.number('price').live(),
    s.placeholder('subtotal').content(({ get }) => get('qty') * get('price')),
  ]).reorderable().collapsible().minItems(1),
]))
```

| Kelompok | Komponen v1 |
| --- | --- |
| Input | `text`, `textarea`, `number`, `email`, `password`, `hidden`, `select`, `multiSelect`, `checkbox`, `checkboxList`, `radio`, `toggle`, `toggleButtons`, `date`, `dateTime`, `time`, `color`, `tags`, `keyValue`, `richEditor`, `markdownEditor`, `codeEditor`, `fileUpload`, `slider` |
| Layout | `grid`, `section`, `fieldset`, `tabs`/`tab`, `wizard`/`step`, `group`, `split` |
| Struktural | `repeater`, `builder` (block editor), `placeholder`, `view` (komponen React host) atau s.fragment() untuk sub-schema deklaratif dari host |
| Infolist entries | `textEntry`, `iconEntry`, `imageEntry`, `colorEntry`, `keyValueEntry`, `repeatableEntry`, `codeEntry` |

Tiga aturan reaktivitas, mengikuti keputusan client-first:

1. `visible`, `hidden`, `disabled`, `label`, `helperText`, `placeholder.content` menerima closure `({ get, record, ctx }) => …`. Compiler mencoba menerjemahkan closure sederhana ke ekspresi json-render (`$cond`, `$template`, `$state`). Closure yang tidak bisa diterjemahkan secara statis jatuh ke `$computed` dengan fungsi yang dikirim sebagai string di spec — dibatasi hanya untuk ekspresi murni tanpa akses `record`/`ctx`.
2. `live()` menandai field sebagai pemicu. `afterStateUpdated` dikompilasi ke `watch` json-render. Default handler-nya berjalan di client dengan `set`/`get`. `live({ server: true })` mengirim `watch` ke `POST /_pupitre/evaluate` yang menjalankan closure di server dengan state lengkap dan mengembalikan patch state.
3. Opsi dinamis (`options(closure)`, `relationship(...).searchable()`) selalu lewat endpoint `GET /_pupitre/options/:resource/:field?q=` dengan debounce; tidak pernah dikirim di spec awal kecuali `preload()`.
   `options(closure)` nhận konteks `{ search, ctx, page, values? }`. Saat server memvalidasi nilai pilihan, `values` berisi nilai yang dikirim dan `search` kosong; closure harus tetap mengembalikan opsi untuk setiap nilai dalam `values`, termasuk yang tidak cocok dengan filter label.

Validasi: setiap rule builder punya padanan VineJS (`required` → tidak optional, `maxLength` → `vine.string().maxLength`, `unique` → `vine.string().unique(...)` dengan query Lucid, `rules([...])` untuk rule custom). Compiler menghasilkan satu `vine.compile()` per form, di-cache per resource. Field di dalam `repeater` menjadi `vine.array(vine.object(...))`; `visible` tidak mempengaruhi validasi kecuali diberi `.dehydratedWhenHidden(false)`, sama seperti Filament.

## Builder API: Table

Table adalah satu komponen "gemuk" di catalog: server memegang query, client memegang interaksi. Seluruh state (sort, filter, search, page, tab, grouping) hidup di URL query, sehingga `router.reload({ only: ['table'] })` cukup untuk refresh.

```ts
import { table as t } from '@rikology/pupitre'

.table((table) => table
  .query((q, ctx) => q.preload('author'))
  .defaultSort('createdAt', 'desc')
  .columns([
    t.text('title').searchable().sortable().limit(50).description(({ record }) => record.slug),
    t.text('author.name').label('Author').sortable(),
    t.badge('status').colors({ draft: 'gray', published: 'green' }),
    t.image('cover').circular(),
    t.toggle('isFeatured').inline(),            // editable in-place
    t.text('viewsCount').numeric().summarize([t.sum(), t.avg()]),
    t.dateTime('publishedAt').since().toggleable({ hiddenByDefault: true }),
  ])
  .filters([
    t.filter.select('status').options({ draft: 'Draft', published: 'Published' }),
    t.filter.ternary('isFeatured'),
    t.filter.dateRange('publishedAt'),
    t.filter.custom('author').form([s.select('authorId').relationship('author', 'name')])
      .query((q, data) => q.where('author_id', data.authorId)),
  ]).filtersLayout('slideover')
  .groups([t.group('status'), t.group('author.name')])
  .searchDebounce(300)
  .paginated([10, 25, 50, 'all'])
  .reorderable('sortOrder')
  .poll('30s')
  .emptyState({ heading: 'No posts yet', action: actions.create() })
)
```

| Fitur Filament | Mekanisme Pupitre |
| --- | --- |
| Sort, search, pagination | Query param `sort`, `q`, `page`, `perPage` → Lucid query builder; search global menggabungkan kolom `searchable()` dengan `whereILike`, kolom relasi lewat `whereHas` |
| Filters | Tiap filter = form kecil (schema yang sama) + `query` callback; nilai diserialisasi ke `filters[status]=draft` |
| Grouping | `groupBy` query param; server mengembalikan rows + `groups[]` dengan header dan summary per grup |
| Summaries | Query agregasi terpisah di atas query yang sudah terfilter, dikirim sebagai `summary` prop |
| Inline edit (`toggle`, `select`, `textInput` column) | `PATCH .../posts/:id/column/:name` dengan validasi VineJS satu field |
| Reorder | `reorderable('sortOrder')` → endpoint `POST .../reorder` dengan `ids[]` |
| Polling / push | `poll()` → Inertia `router.reload` berkala; client realtime + channel mengganti interval dengan ping invalidasi. Tanpa keduanya, polling tetap aktif |
| Column toggles & layout | Disimpan di `localStorage` per tabel; `t.layout.grid()` untuk card layout |

Kolom v1: `text`, `badge`, `icon`, `image`, `color`, `toggle`, `select`, `textInput`, `checkbox`, `custom` (komponen React host) atau t.fragment() untuk spec deklaratif. Kolom relasi memakai notasi titik `author.name`; compiler menerjemahkannya ke `preload` + `whereHas` untuk sort dan search.

Sisi client: `DataTable` memakai TanStack Table hanya untuk rendering dan column state, bukan sorting/filtering (semua server-side). Baris memakai `Transformer` v7 dari resource, jadi kolom bisa mengakses atribut hasil transformer, bukan hanya kolom DB.

## Builder API: Actions & protokol modal

Satu tipe `action` dipakai di header, baris, bulk, form, infolist, dan widget, seperti Filament v4 yang menyatukan semua action. Yang membedakan hanya konteks (`record`, `records`, `form`).

```ts
import { action, actions } from '@rikology/pupitre'

export const publish = action('publish')
  .label('Publish')
  .icon('send').color('success')
  .visible(({ record }) => record.status === 'draft')
  .can('publish')                                  // Bouncer ability
  .requiresConfirmation().modalHeading('Publish this post?')
  .form([
    s.dateTime('publishedAt').default(() => DateTime.now()),
    s.toggle('notifySubscribers'),
  ])
  .fillForm(({ record }) => ({ publishedAt: record.scheduledAt }))
  .handle(async ({ record, data, ctx, notify }) => {
    await record.merge({ status: 'published', ...data }).save()
    notify.success('Published').send()
  })
  .after(({ redirect }) => redirect.back())

// bulk
actions.bulk('archive').handle(({ records }) => ...).deselectAfter()
// bawaan
actions.create() / edit() / view() / delete() / restore() / forceDelete() / replicate() / export() / import()
```
`actions.export()` tersedia di header maupun bulk; kolom default berasal dari kolom tabel yang tampak, dan `.columns([exportColumn('title').label('Title').formatStateUsing(...)])` dapat mengubah label/format nilai. Ekspor memakai query tabel aktif (search/filter/sort/tab/prefix), format CSV, dan batas `exports.maxSyncRows` (default 1.000): jumlah hingga ambang itu diekspor sinkron. Di atas ambang, bila `jobs` tersedia dan jumlahnya tidak melebihi `exports.maxAsyncRows` (default 100.000), endpoint mengantrekan ekspor; tanpa adapter, ekspor di atas ambang sinkron menghasilkan error limit yang jelas. Progress dicatat per bagian dan file CSV disimpan privat; adapter notifikasi opsional dapat mengabarkan penyelesaian.

Semua unduhan CSV (ekspor sinkron, ekspor antrean, dan baris impor gagal) mencegah formula injection spreadsheet: sel string dan header yang diawali `=`, `+`, `-`, `@`, tab, atau carriage return diberi awalan tanda kutip tunggal. Nilai bertipe angka tetap angka, termasuk angka negatif. Saat CSV hasil ekspor diimpor kembali, awalan kutip dipertahankan secara literal, bukan dihapus otomatis.

`actions.import()` memakai definisi field form resource sebagai import columns (field layout/repeater/file tidak dijadikan kolom langsung). UI menampilkan header CSV dan meminta mapping ke field; kolom dengan mapping kosong (`''`, Skip) diabaikan, baris dipetakan lalu divalidasi dengan VineJS dari schema form yang sama. `.resolveRecord(({ data, ctx }) => ...)` opsional menentukan record untuk update/upsert; tanpa callback row menjadi record baru. Setiap row memakai ability `create` atau `update`, ownership tenancy diisi server, dan transaction/hook resource berjalan per row. Ringkasan menyertakan URL CSV untuk baris gagal. `.async()` pada import + jobs adapter mengembalikan job ID dan menyimpan ringkasan untuk endpoint progress.

`action.async()` berlaku pada bulk action serta `actions.import()`. Handler tetap (`pupitre.export`, `pupitre.import`, `pupitre.bulk`) diregistrasikan saat Pupitre boot, bukan dalam request; payload queue hanya berisi identitas serializable (panel/resource/action, ids, user/tenant IDs, row/file IDs, storage key, mapping, dan query options). Worker memuat ulang user, tenant, definisi dan record lewat query scoped yang sama. Action callbacks pada worker menerima job context (`ctx.pupitre` dengan panel, user, tenant, locale/timezone serta `ctx.params` untuk nested parent), bukan request HTTP; callback tidak boleh mengandalkan response, session atau upload temporer. Tanpa adapter, bulk/import tetap berjalan sinkron.

Protokol di jaringan:

1. Spec halaman hanya membawa descriptor ringan per action: `name`, `label`, `icon`, `color`, `kind` (`link` | `confirm` | `form` | `direct`), `url`, hasil `visible`/`can` yang sudah dievaluasi server per record.
2. `kind: link` → `router.visit`. `kind: direct` → `POST url` langsung. `kind: confirm` → dialog client, lalu `POST`.
3. `kind: form` → `GET url` mengembalikan `{ spec, state }` (hasil `form()` + `fillForm()`), modal dirender dari spec; submit `POST url` dengan body state. Bulk mengirim `ids[]` di body dan menerima `{ spec, state }` yang sama.
4. Respons: redirect Inertia biasa (`redirect.back()` memicu reload props halaman) atau `{ patch }` JSON untuk kasus yang hanya ingin refresh tabel (`refresh.table()`).

URL: `/admin/posts/:id/actions/publish` untuk row, `/admin/posts/actions/archive` untuk bulk dan header, `/admin/posts/:id/relations/comments/:cid/actions/...` untuk relation manager. Semua dinamai dan masuk `urlFor`.

| Fitur Filament | v1 |
| --- | --- |
| Modal: heading, description, width, slideOver, icon, submit/cancel label | Ya |
| `action.group([...])` dropdown | Ya |
| `keyBindings(['mod+s'])` | Ya |
| `url()` + `openUrlInNewTab()` | Ya |
| `extraModalFooterActions` | Ya |
| Wizard di dalam modal | Ya (schema `wizard` berlaku di mana saja) |
| `mountUsing` | Dipetakan ke `fillForm` |
| `successNotification` / `failureNotification` | Ya, via `notify` di handler |
| Modal deep-linkable | Opt-in per action lewat .deepLinkable(): URL ?action=publish&record=12 membuka modal saat halaman dimuat |

## Widgets, custom pages, relation managers, global search, notifications

Semua fitur ini memakai primitif yang sama (schema, table, action) sehingga tidak menambah konsep baru di sisi client.

**Widgets.** `defineWidget()` menghasilkan spec sebagian; dashboard = grid dari widget. Tiga jenis bawaan: `stats` (kartu angka + sparkline), `chart` (Recharts: line, bar, area, pie, doughnut), `table` (memakai builder table yang sama). Data widget dimuat sebagai Inertia deferred prop, jadi halaman tampil dulu, angka menyusul. `poll()` dan `filters` (form kecil di atas dashboard) didukung.

```ts
export default defineWidget('post-stats').span(2).sort(1)
  .stats(async ({ ctx, filters }) => [
    stat('Published', await Post.query().where('status', 'published').count()).chart([3, 5, 8]).color('success'),
    stat('Drafts', await Post.query().where('status', 'draft').count()),
  ])
```

**Custom pages.** `definePage()` = route + schema + actions tanpa model. Untuk halaman yang benar-benar butuh React bebas, `.component('admin/Reports')` merender page Inertia host dengan shell panel tetap dipasang.

```ts
export default definePage('settings').path('/settings').icon('settings')
  .form([s.text('siteName'), s.fileUpload('logo')])
  .fill(() => Setting.all()).save(({ data }) => Setting.update(data))
  .actions([clearCache])
```

**Relation managers.** `defineRelationManager(Post, 'comments')` membungkus table + form untuk relasi hasMany/manyToMany. Di halaman edit tampil sebagai tab di bawah form; datanya deferred prop per relation, URL state tabelnya diberi prefix (`comments[sort]`). Attach/detach/associate untuk manyToMany dan belongsTo bawaan. Nested resource (`/posts/:id/revisions`) adalah resource penuh dengan `parent()`; sidebar menampilkan breadcrumb parent.

**Global search.** Tiap resource dengan `globallySearchable()` menyumbang query; endpoint `GET /_pupitre/search?q=` menjalankan semuanya paralel dengan batas 5 hasil per resource, hasil = `{ resource, title, details, url }`. Client memakai cmdk; shortcut dari panel.

**Notifications.** Dua jalur: flash (shared prop `flash` → toast) dan database notifications (inbox lewat adapter `notifications`, bukan tabel milik Pupitre). API server: `notify.success('Saved').body('...').actions([...]).sendToDatabase(user)`. Dengan `transmitRealtime()` dan instance host `transmitRealtimeClient()` pada `<Pupitre realtime={client} />`, ping `{ type: 'pupitre:notification' }` pada channel user setiap panel yang mengaktifkan notifications memicu reload shared props dan inbox terbuka. Tanpa client/channel, interval panel tetap menjadi fallback. Tabel memakai `{ type: 'pupitre:table', resource }` di channel panel/tenant untuk mengambil ulang `dataProp`; event tidak memuat data sensitif.

## Compiler: builder → spec json-render

Compiler mengubah satu schema builder menjadi `{ spec, state, catalogVersion }` per request. Spec adalah pohon json-render flat (`root` + `elements`); state adalah JSON pointer tree yang diisi dari record. Compiler berjalan di server, hasilnya di-cache per resource + locale + hash closure, dan hanya bagian yang bergantung record (`visible` per baris, `fillForm`) dievaluasi ulang.

Contoh hasil untuk `s.select('status').live()` dan `s.dateTime('publishedAt').visible(get('status') === 'published')`:

```json
{
  "root": "form",
  "elements": {
    "form": { "type": "Form", "props": { "method": "put", "url": "/admin/posts/12" }, "children": ["f.status", "f.publishedAt"] },
    "f.status": {
      "type": "Select",
      "props": { "name": "status", "label": "Status", "value": { "$bindState": "/data/status" },
                 "options": [{ "value": "draft", "label": "Draft" }, { "value": "published", "label": "Published" }],
                 "error": { "$state": "/errors/status" } }
    },
    "f.publishedAt": {
      "type": "DateTime",
      "props": { "name": "publishedAt", "label": "Published at", "value": { "$bindState": "/data/publishedAt" } },
      "visible": { "$state": "/data/status", "eq": "published" }
    }
  }
}
```

Model state yang dipakai semua komponen:

| Path | Isi |
| --- | --- |
| `/data/**` | Nilai form, bentuknya sama dengan body yang dikirim ke VineJS |
| `/errors/**` | Pesan error per field, path sama dengan `/data` |
| `/meta/dirty`, `/meta/submitting`, `/meta/record` | Status form + snapshot record read-only untuk closure `record` |
| `/ui/**` | State murni client: tab aktif, step wizard, collapsed section |
| `/options/<field>` | Hasil fetch opsi dinamis |

Komponen catalog dibagi dua lapis. Lapis primitif (`Section`, `Grid`, `Tabs`, `Text`, `Select`, ...) memakai props Zod sederhana dan bisa diganti satu-satu lewat registry. Lapis domain (`DataTable`, `Repeater`, `Builder`, `RelationManager`, `ActionBar`, `FileUpload`, `RelationSelect`, `Widget.*`) menerima satu prop `descriptor` bertipe milik Pupitre, bukan pohon json-render, karena isinya punya state internal dan protokol jaringan sendiri. Repeater menyimpan array di `/data/items` dan merender sub-spec per item dengan prefix pointer (`/data/items/0/sku`); ini yang harus dibuktikan di spike.

Aturan closure: compiler mencoba mengangkat closure menjadi ekspresi json-render dengan menjalankannya terhadap proxy `get` yang merekam akses path dan operasi perbandingan. Closure yang memanggil fungsi luar, mengakses `ctx`, atau bercabang kompleks gagal diangkat; untuk `visible`/`disabled` ia dievaluasi sekali di server dengan state awal dan ditandai `static`, untuk `afterStateUpdated` ia dipaksa `server: true`. Hasil keputusan ini dilaporkan `node ace pupitre:inspect posts` supaya developer tahu mana yang round-trip.

## Client runtime

Satu page Inertia `pupitre.tsx` melayani semua route panel; yang berbeda per halaman hanya props `page: { kind, spec, state, data, actions, nav }`. Tidak ada page per resource, jadi tidak ada resolusi komponen dari `node_modules`.

&#91;embedded content: alur render · 7 komponen, satu loop\]

Satu loop: interaksi di komponen menjadi action di bridge, masuk router sebagai request Inertia, controller menjalankan hooks dan validasi, compiler menghasilkan spec + state baru yang kembali sebagai props ke halaman yang sama.

Empat bagian runtime di `pupitre-react`:

1. **Shell**: sidebar, topbar, tenant switcher, global search, notification tray, breadcrumb. Dirender dari `nav` prop; komponennya dari registry seperti yang lain.
2. **Renderer**: `@json-render/react` dengan `StateStore` yang hidup di luar page component (Zustand adapter), diinisialisasi dari `state` prop dan hanya di-reset saat `page.key` berubah (navigasi ke record lain). Reload props Inertia memperbarui `/meta/record` dan `/errors`, bukan `/data`, sehingga ketikan user tidak hilang.
3. **Inertia bridge**: implementasi semua action json-render: `setState` (bawaan), `visit`, `reload({ only })`, `submitForm`, `openAction`, `runAction`, `evaluate` (untuk `live({ server: true })`), `fetchOptions`, `upload`. Semuanya memakai `router` Inertia v3 (deferred props, `only`, `preserveState`), bukan fetch manual, sehingga flash, redirect, dan error 422 ditangani seragam.
4. **Registry**: `defineRegistry(catalog, components)`; default `components` diimpor dari `pupitre-ui`. Host menimpa satu-satu: `components: { ...pupitreUi, Select: MySelect }`. Komponen hasil `shadcn add` punya kontrak Zod yang sama, jadi penggantiannya type-checked.

Distribusi `pupitre-ui` ganda: paket npm dan registry shadcn dari sumber yang sama. `npx shadcn@4 add https://pupitre.rikology.com/r/select.json` menyalin sumber ke `inertia/components/pupitre/`; CI memastikan registry tidak tertinggal. Semua komponen memakai Base UI, bukan Radix.

Kontrak WP40: manifest di `packages/pupitre-ui/registry/registry.json`, payload berisi `content` di `registry/public/r/`, index publik di `registry/public/registry.json`. Docs menyajikan `/registry.json` dan `/r/*`. Jenis item tetap semantik (`registry:component`, `registry:lib`, `registry:hook`, dan lainnya), tetapi setiap file memakai `registry:file` dengan target `~/inertia/components/pupitre/<path-sumber>`. Shadcn menyelesaikan `~/` relatif terhadap root host (`--cwd`), bukan alias `components.json` atau direktori `src`. Nama item hook memakai kebab-case; nama file underscore tetap dipertahankan agar import relatif tidak berubah. Jangan memakai `--path`: shadcn meratakan semua file ke basename dan memutus import.

Ace: `node ace pupitre:ui add select --yes`; `add` ialah operasi. `--registry <origin>` mengganti origin index/item; `--dry-run` memvalidasi tanpa menyalin. Installer memakai `npx shadcn@4 add` tanpa passthrough `--path`. Aktifkan override di `inertia/admin/registry.ts`.

Batasan SSR-safe: tidak ada akses `window`/`document` di module scope; editor (Tiptap, CodeMirror), chart, dan map di-lazy-load lewat `React.lazy`; store dibuat di dalam provider, bukan singleton modul.

**Theming.** Dua lapis: CSS variables shadcn (primary, radius, dark mode) yang bisa diubah dari `.theme({ primary, radius, darkMode })`, dan theme file per panel `app/admin/themes/<panel>.ts` yang mengatur font, density (`compact` | `comfortable`), gaya sidebar (`expanded` | `collapsed` | `top-nav`), lebar konten, dan token tambahan. Theme file dikompilasi ke CSS variables yang disuntik di root page, jadi komponen registry tidak perlu tahu theme mana yang aktif. Theme per tenant dari DB tidak masuk v1.

## Tenancy, auth, otorisasi, adapter

**Tenancy.** Pupitre tidak punya resolver atau middleware tenancy sendiri; ia memakai adapter `tenancy` (lihat Adapters) dengan driver resmi di atas `@rikology/adonisjs-tenant`. Mode `url` memasang `PathResolver` dan prefix route `/:tenant`; mode `implicit` memakai resolver custom yang membaca `user.currentTenantId`. Model yang memakai mixin `TenantScope` sudah fail-closed; model tanpa mixin mendapat `scope` default `where(ownership, tenant.id)` dari driver, dan create otomatis mengisi kolom ownership. Resource bisa `.scope(false)` untuk tabel global (misal daftar tenant itu sendiri). Yang tetap fitur panel: tenant switcher di sidebar (dari `listForUser`), action "switch tenant" di mode implisit, serta tenant registration/profile page (`.tenancy({ registration: TenantForm })`) seperti Filament, opsional.

**Auth.** Panel memakai guard `@adonisjs/auth` milik host, biasanya `web` (session). Halaman bawaan: login, register (bisa dimatikan), forgot/reset password (token tabel `pupitre_password_resets`, email via `@adonisjs/mail` host), email verification (opsional), profile (nama, email, password, avatar via Flydrive), MFA TOTP (`otplib`, secret terenkripsi di kolom `mfa_secret`, recovery codes), passkeys/WebAuthn (@simplewebauthn/server, tabel pupitre\_passkeys), dan social login Google/GitHub lewat @adonisjs/ally dengan tombol di halaman login (provider dikonfigurasi lewat .social(\['google', 'github'\])). Semua halaman auth adalah page berbasis spec, jadi tampilannya mengikuti registry yang sama. Kalau host sudah punya auth dari starter kit, `.login(false)` dan panel hanya memakai guard.

**Otorisasi.** Pemetaan Bouncer:

| Aksi panel | Ability policy | Catatan |
| --- | --- | --- |
| Lihat list / nav item | `viewAny` | Nav item disembunyikan kalau `false` |
| Buka record | `view` |  |
| Create page + tombol | `create` |  |
| Edit page + tombol | `update` |  |
| Delete / restore / forceDelete | `delete` / `restore` / `forceDelete` |  |
| Replicate action | `replicate` lalu fallback `create` | Salinan dibuat dari record dalam scope/tenant aktif; primary key, timestamps, dan kolom soft-delete tidak disalin |
| Action custom `.can('publish')` | `publish` | Ability dengan nama sama di policy |
| Reorder | reserved `reorder` | Belum ada endpoint reorder M2; inline edit memakai `update` |

Tanpa policy, default `allow` (sama seperti Filament tanpa Shield), dengan peringatan di `pupitre:inspect`. Perintah ini juga melaporkan ability yang dibutuhkan resource tetapi tidak diimplementasikan policy. Plugin `pupitre-shield` menambah tabel roles/permissions, UI pengelolaannya, dan policy generik yang membaca permission `posts.update` dari DB.

Shield WP37 memakai permission global `<slug>.<ability>`, semua ability memiliki method policy sendiri sehingga tidak memakai fallback core. `.policy()` eksplisit tetap utuh; gunakan `except` untuk kebijakan yang hanya terdaftar melalui config. `shieldRolesField()` membutuhkan relation `roles` pada User host; `shieldCan('settings.access')` dipasang pada `.canAccess()` page dengan grant eksplisit. `shield:sync --user=<id|email>` menyinkronkan permission dan bootstrap super-admin; semua lookup role/permission di-cache per request/user, bukan lintas request.

**Adapters.** Semua di `config/pupitre.ts`, tipe interface diekspor dari core:

- `jobs`: `{ dispatch(job, payload): Promise<void>; register(job, handler): void }` untuk export/import besar, scheduled report, bulk action `.async()`. Driver resmi memakai @adonisjs/queue (optional peer, lazy import dari @rikology/pupitre/drivers/queue); handler harus diregistrasi saat boot agar worker dapat menjalankan job. Tanpa adapter, jalur sinkron dibatasi konfigurasi baris.
- `realtime`: `{ driver, publish(channel, event), initialize?(manager) }` di server; client memiliki `{ subscribe(channel, cb) }`. Tanpa client, polling memakai interval panel. `pupitre-transmit` menggunakan `panelGuard` dan `realtimeChannels.patterns` milik core untuk otorisasi channel, bukan format/guard salinan.
- `storage`: disk Flydrive untuk `fileUpload`, `export`, avatar.
- `mail`: mailer `@adonisjs/mail` untuk reset password, verifikasi, notifikasi email.
- `cache`: untuk compiled schema dan hasil `summarize`; default in-memory, bisa Bentocache.

* `tenancy`: `{ resolve(ctx), scope(query, tenant), fill(record, tenant), listForUser(user) }`. Driver resmi memakai `@rikology/adonisjs-tenant`: mode `url` = `PathResolver` + prefix route, mode `implicit` = resolver custom dari kolom user; scoping lewat mixin `TenantScope` bila model memakainya, atau `scope` default dari driver bila tidak.
* `notifications`: `{ flash(ctx, message), toInbox(user, message), inbox(user, page), markRead(user, ids) }`. Driver resmi memakai `@rikology/adonisjs-notifications`: `notify.success().sendToDatabase(user)` menjadi notification class ke channel `database`, inbox dibaca dari `user.notifications()`. Tanpa driver, hanya flash yang bekerja.
* `audit`: `{ forRecord(model, id, { page, perPage, tenantId? }) }` untuk timeline record. Driver resmi membaca `Audit` dari `@rikology/adonisjs-audit-trail`. Adapter kustom hanya menyediakan timeline; resource Activity milik `pupitre-audit` secara khusus memakai model audit-trail, bukan adapter ini.

## Ace commands & discovery hook

`node ace add @rikology/pupitre` memasang provider, middleware, config, page `pupitre.tsx`, registry, migrasi tabel `pupitre_password_resets` dan `pupitre_passkeys` plus kolom MFA di users (tabel notifikasi dan audit datang dari package masing-masing), dan hook `indexAdmin` di `adonisrc.ts`.

| Command | Hasil |
| --- | --- |
| `pupitre:install` | Semua di atas, idempotent; opsi `--panel=admin --path=/admin --auth=web` |
| `make:resource Post` | `app/admin/resources/post_resource.ts`. Introspeksi model Lucid: kolom + tipe → field dan column yang cocok (string → `text`, boolean → `toggle`, DateTime → `dateTime`, enum dari `@column` meta → `select`, belongsTo → `select().relationship()`, hasMany → relation manager stub). Opsi `--from-migration` kalau model belum punya tipe |
| `make:page Settings` | `definePage` stub dengan form kosong |
| `make:widget PostStats --type=stats\|chart\|table` | Stub widget |
| `make:relation-manager Post comments` | Stub dengan table + form relasi |
| `make:panel app` | Panel kedua dengan path dan guard sendiri |
| `make:plugin acme-audit [--package] [--dir ./plugins/audit]` | Default: `app/admin/plugins/acme_audit_plugin.ts`; `--package`: jalankan `npx --yes @rikology/create-pupitre-plugin@<major-core> acme-audit --dir <dir>` untuk package mandiri |
| `pupitre:inspect posts` | Cetak closure yang jatuh ke `static`/`server`, policy yang hilang, kolom tanpa index untuk `searchable` |
| `pupitre:routes` | Daftar route panel + nama `urlFor` |
| `pupitre:ui add select` | Pembungkus `npx shadcn add` dari registry Pupitre |

Hook discovery mengikuti pola `indexPolicies` v7: `indexAdmin()` di `adonisrc.ts` memindai `app/admin/{resources,pages,widgets,relation_managers,panels}` saat dev dan build, menulis `.adonisjs/server/admin.ts` berisi `resources`, `pages`, `widgets` sebagai objek bertipe dengan key slug. Panel mengimpor dari situ; salah ketik slug di `nav.items([...])` jadi error TypeScript.

**Testing utilities.** `@rikology/pupitre/testing` menyediakan helper Japa `visitResource`, `submitForm`, `runAction`, `visitPage` yang berjalan lewat controller asli (authz, tenancy, hooks, transaksi) serta assertion wire-spec `assertSpecHas`, `assertVisible`, dan `assertHidden` (lihat [TESTING.md §7](./TESTING.md)). `@rikology/pupitre-ui/testing` mengekspor fixture Playwright `pupitreTest` (option `pupitre: { panelPath, basePath?, landingPath?, email?, password? }` di `use` config) dan page object `AdminPage` untuk login, navigasi resource, field/action/modal, toast, dan row/table helpers.

## Spike, roadmap, risiko, open questions

Spike dulu, 1–2 hari, di satu app AdonisJS v7 + Inertia React kosong. Spike dianggap lulus kalau lima tugas ini jalan tanpa fork json-render:

- [ ] `@json-render/core` punya primitif iterasi array (repeat/pushState/removeState) atau Repeater bisa dibuat sebagai komponen gemuk yang merender sub-spec per item dengan prefix pointer
- [ ] State form bertahan saat `router.reload({ only })` dan saat respons 422 mengisi `/errors`
- [ ] `watch` memicu handler custom yang memanggil `router.reload` / `router.post` tanpa re-mount Renderer
- [ ] Registry bisa menerima komponen shadcn Base UI milik host dengan kontrak Zod yang sama tanpa paket Radix-based `@json-render/shadcn`
- [ ] Tidak ada akses `window` di module scope `@json-render/react` (SSR-safe untuk nanti)

Milestone, urutannya dari yang bisa dipakai dogfood paling awal:

&#91;embedded content: roadmap · 5 milestone, 5 gate\]

| Milestone | Isi | Gate |
| --- | --- | --- |
| M0 Spike | Lima tugas di atas | Lulus semua, atau keputusan fallback ke spec sendiri |
| M1 Core | definePanel minimal, defineResource, schema (input + layout), compiler, VineJS, table (sort/search/filter/pagination), actions (create/edit/delete/custom), page generik, pupitre-ui dasar | Satu project internal memakainya untuk 3+ resource |
| M2 Panel | Auth lengkap, nav, Bouncer mapping, tenancy dua mode, notifications polling, global search, custom page, `make:resource` | Project internal kedua pindah ke Pupitre |
| M3 Parity | Widgets, relation managers, nested resource, repeater/builder/wizard, inline edit, grouping/summaries, import/export CSV + driver @adonisjs/queue, MFA TOTP, passkeys, social login, theme per panel, testing helpers | Checklist fitur Filament v4 terpenuhi |
| M4 Ecosystem | pupitre-shield, pupitre-audit (UI di atas adonisjs-audit-trail), pupitre-transmit, shadcn registry publik, fixture Playwright, docs site, `make:plugin` | Rilis 1.0 |

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| json-render breaking change atau mati (project Labs) | Compiler + renderer tipis harus ditulis ulang | Hanya compiler dan `pupitre-react` yang menyentuh format spec; pin versi, vendor kalau perlu |
| Closure lifting gagal untuk banyak kasus nyata | Terlalu banyak round-trip, DX jelek | `pupitre:inspect` memperlihatkan hasil; dokumentasi pola yang bisa diangkat; `server: true` eksplisit |
| Bundle client besar (editor, chart, table) | Halaman admin lambat | Lazy-load per komponen; registry hanya memuat yang dipakai |
| Ekosistem plugin kecil | Nilai jual Filament sebagian dari plugin | Plugin API stabil sejak M1; dua plugin resmi sebagai contoh |
| @adonisjs/queue masih 0.x (0.6.2, Juni 2026) | Driver jobs resmi ikut breaking change minor; tanpa driver, import/export besar sinkron | Adapter; batas baris + peringatan; driver resmi dipin ke minor `@adonisjs/queue` rilis |

Open questions, belum perlu dijawab sebelum M0:

- [ ] Modal deep-linkable (`?action=publish&record=12`) — diputuskan: opt-in .deepLinkable() per action, masuk M3
- [ ] Format `custom` column/field dari host: diputuskan dua-duanya, komponen React untuk kasus bebas dan fragment deklaratif untuk sisanya
- [ ] Cache compiled schema per tenant kalau `visible` bergantung tenant — diputuskan: cache per panel:resource:page:locale:hash(closure); closure yang bergantung ctx/tenant ditandai static, dievaluasi per request, hasilnya ditambal ke spec cache
- [ ] Diputuskan: React dulu, Vue/Svelte lewat renderer json-render lain setelah 1.0; kontrak catalog tinggal di pupitre/catalog agar framework-agnostic
- [ ] Domain docs/registry (`pupitre.rikology.com`?) dan org GitHub: `rikoriswandha/pupitre` — diputuskan: repo pribadi rikoriswandha/pupitre, domain pupitre.rikology.com
