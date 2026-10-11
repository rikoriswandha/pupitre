# Pupitre — Strategi Pengujian

Tiga lapis: unit murni (builder, compiler, catalog), integrasi dalam container Adonis (route, query, authz, tenancy), dan browser (example app). Setiap lapis punya alat dan aturan sendiri; yang diuji adalah **perilaku yang terlihat konsumen**, bukan wiring.

## 1. Peta lapis

| Lapis | Package | Runner | DB | Apa yang diuji |
| --- | --- | --- | --- | --- |
| Unit | `pupitre/catalog` | Japa | — | fixture spec ↔ Zod; `catalogVersion` |
| Unit | `pupitre` builder/compiler | Japa | — | `toJSON()` deterministik, snapshot spec, closure lifter, VineJS compiler, table query → SQL (`toQuery()`) |
| Integrasi | `pupitre` http/query/authz/tenancy | Japa + `IgnitorFactory` + `@japa/api-client` + `@japa/plugin-adonisjs` | SQLite default; PostgreSQL via `DB=pg` | route lifecycle, 403/404/422, hooks, transaksi, scope tenant, options/search/evaluate |
| Unit React | `pupitre-react` | Japa + happy-dom (atau Vitest kalau Japa JSX terlalu kaku) | — | store reset by key, 422 mapping, bridge actions (Inertia router di-mock), modal lifecycle |
| Komponen | `pupitre-ui` | Playwright component test atau Storybook test-runner | — | tiap fixture catalog render + interaksi dasar + a11y (axe) |
| E2E | `apps/example` | Playwright | SQLite | alur CRUD, action, filter, tenancy switch, auth, 422, notifikasi |
| Kontrak | lintas | Japa | — | `assertRegistryComplete`; snapshot `WIRE_PROTOCOL` types (tsd) |

## 2. Unit: builder & compiler

- **Snapshot spec**: `tests/compiler/fixtures/<name>.resource.ts` → `compile()` → bandingkan dengan `<name>.spec.json`. Snapshot diperbarui eksplisit (`bin/test.ts --files=<spec> --update-snapshots`, flag `@japa/snapshot`), diff di PR wajib direview.
- **Closure lifter** diuji dengan tabel kasus:

| Closure | Hasil |
| --- | --- |
| `({get}) => get('status') === 'published'` | `{ $state: '/data/status', eq: 'published' }` |
| `({get}) => get('a') && get('b') !== 'x'` | `{ $and: [...] }` |
| `` ({get}) => `Hello ${get('name')}` `` | `{ $template: 'Hello ${/data/name}' }` |
| `({get}) => get('qty') * get('price')` | `{ $computed: 'mul', args }` |
| `({record}) => record.isAdmin` | `static` |
| `({get}) => slugify(get('title'))` | `static` (visible) / `server` (afterStateUpdated) |

- **VineJS compiler**: setiap rule menghasilkan error pada input salah dan lolos pada input benar; path error nested `items.0.sku`; `dehydratedWhenHidden(false)` menghapus field dari output; `unique` memakai query Lucid (test integrasi).
- **Table query**: `table_query.ts` menerima `URLSearchParams` + definition → Lucid query; assert `toQuery()` SQL untuk sort/search/filter/relasi (whereHas) dan 400 untuk sort non-sortable. Format cell (timezone, angka) diuji dengan `Settings.defaultZone` Luxon dikunci.

## 3. Integrasi dalam container

Helper `tests/helpers/app.ts` membuat app via `IgnitorFactory` dengan `rcFileContents` (provider Pupitre, Lucid, Inertia, Bouncer, Auth, Session, Shield), config in-memory, dan model fixture (`Post`, `Category`, `User`, `Tenant`) + migrasi SQLite in-memory. Tiap test file memakai `group.each.setup(() => testUtils.db().withGlobalTransaction())`.

Wajib ada:

- **Matriks authz**: untuk setiap route panel × ability (`allow`/`deny`) → status. Dibangkitkan dari `router.ts` sehingga route baru otomatis ikut.
- **Tenancy**: user tenant A membuka record tenant B → 404; create → `tenant_id` terisi; `.scope(false)` → tidak difilter; mode `implicit` tanpa `currentTenantId` → redirect pemilihan tenant.
- **Action**: GET form → spec; POST invalid → 422 ke modal; POST valid → redirect + flash; POST tanpa `can` → 403 meskipun `enabled: true` dipalsukan.
- **Inertia props**: assert bentuk `page` (Zod dari WIRE_PROTOCOL) untuk tiap `kind`; `only: ['page.data']` hanya mengembalikan `page.data`.
- **Hooks**: urutan `mutateBeforeSave → beforeSave → save → afterSave` dicatat; exception di `afterSave` me-rollback.
- **Driver optional peer**: test driver dijalankan hanya kalau peer terpasang (`test.skipIf(!hasPeer)`), dan test terpisah memastikan **tanpa** peer error-nya jelas (`E_PUPITRE_MISSING_PEER`).

PostgreSQL: job CI `test:pg` menjalankan file yang ditandai `@pg` (query ILIKE, jsonb, `whereHas` + grouping). SQLite tetap default lokal.

## 4. pupitre-react

- Store: render `<Pupitre page={A}/>`, ketik, rerender dengan `page` yang `key` sama tapi `state` berbeda → `/data` tetap; `key` berbeda → reset.
- Bridge: `router` Inertia diganti lewat seam `setRouter()` dan `fetch` lewat `setFetch()` (tanpa monkey-patch modul); `submitForm` memanggil `router.put(url, data, { preserveState: true, onError })`; `onError({ 'items.0.sku': 'x' })` → `store.get('/errors/items/0/sku') === 'x'`. Action JSON (ADR-0012): 422 → `/errors/**` modal, 403 → toast + modal tetap, `ActionResult.patch/reload/redirect/deselect`.
- Regression suite spike json-render (`tests/spike/**`, K1–K5) wajib hijau saat upgrade `@json-render/*`.
- `catalogVersion` mismatch → toast + reload.
- Tanpa SSR di v1, tetapi test `renderToString` di Node dipertahankan supaya tidak ada regresi `window` di module scope.

## 5. pupitre-ui

- Satu test per komponen dari fixture catalog: render dengan props fixture, cek a11y (axe, tanpa `critical`), interaksi inti (Select pilih opsi → state, Repeater add/remove, DataTable sort klik → `reload` dengan `sort` + `only: ['data']`, Tabs, modal action, ConfirmDialog, FileUpload, RichEditor lazy chunk). File test CT hanya mengimpor **komponen story** dari `tests/ct/stories/*.story.tsx`; registry, runtime, router/fetch palsu dipasang di dalam story (sisi browser), karena Playwright CT mengeksekusi file test di Node lewat transform JSX-nya. Observasi dibaca lewat DOM (`data-testid`).
- Visual snapshot hanya untuk shell (sidebar, topbar) dan DataTable; komponen input tidak di-snapshot visual (terlalu rapuh).
- `registry:check` memastikan sumber komponen = registry.

## 6. E2E (example app)

Alur minimum (M1), tiap alur satu file `e2e/*.spec.ts` memakai fixture `pupitreTest` dan page object `AdminPage`:

1. Login → dashboard → nav ke Posts → list menampilkan seed.
2. Create post invalid → error inline; valid → redirect edit + toast.
3. Edit: ubah status → field `publishedAt` muncul (reaktivitas client) → save.
4. Row action `publish` (form modal) → submit → badge berubah tanpa reload penuh.
5. Filter status + search + sort → URL berubah → reload halaman mempertahankan state → back button bekerja.
6. Bulk delete 2 baris → konfirmasi → hilang.
7. Switch tenant → list berbeda; URL langsung ke tenant lain → 404.
8. Repeater `items`: add 2 item, isi, hapus item pertama → item kedua utuh; submit dengan item invalid → error hanya di item itu.
9. Upload cover (PNG) → preview tampil → save → key tersimpan; upload file `.exe` berganti nama `.png` → ditolak.
10. Rich editor: ketik + bold → save → view page merender HTML tersanitasi (script yang disisipkan hilang).
11. View page: infolist menampilkan nilai terformat (tanggal di timezone panel).

M2+: auth lengkap (reset password via mail fake), MFA, passkeys (virtual authenticator Playwright), global search, notifications, relation manager, wizard, builder.

## 7. Helper publik `@rikology/pupitre/testing`

Subpath ini menyediakan assertion atas spec wire dan helper integrasi Japa. `assertSpecHas`
mencari komponen berdasarkan `type`, nama element opsional, dan subset `props`;
`assertVisible`/`assertHidden` mengevaluasi ekspresi visibility compiler (`$state`, operator
perbandingan, `$and`, `$or`) terhadap state wire.

```ts
const page = await visitResource('posts', 'edit', { user, record: post, tenant })
assertSpecHas(page.spec, { type: 'TextInput', name: 'title' })
assertVisible(page.spec, page.state, 'publishedAt')

const invalid = await submitForm('posts', 'create', data, { user })
invalid.assertErrors({ 'items.0.sku': 'required' })
const saved = await submitForm('posts', 'edit', nextData, { user, record: post })
saved.assertOk()

const result = await runAction('posts', 'publish', { user, record: post, data })
await visitPage('analytics', { user })
```

`visitResource`/`visitPage` render through the registered controllers. `submitForm` uses the
resource controller's VineJS validation, authorization, hooks, transaction and persistence;
`runAction` uses the action controller and returns validation errors for HTTP 422, while denied
abilities fail as forbidden. Supply `user` for every call; record/page helpers also accept
`tenant`, and resource helpers accept `panel`. Tests should use an isolated SQLite test database.


## 8. Aturan

- Tidak menguji wiring (`route terdaftar`), copy string UI, atau default yang kebetulan.
- Snapshot spec diperbolehkan karena spec **adalah** kontrak; snapshot HTML tidak.
- Test yang menyentuh waktu memakai `DateTime` Luxon dengan `Settings.now` dikunci dan timezone eksplisit (`Asia/Jakarta` + satu kasus DST `Europe/Amsterdam`).
- Test DB tidak boleh menyentuh `.env` developer: helper memaksa `DB_CONNECTION=sqlite` + file sementara kecuali `DB=pg` eksplisit.
- Coverage gate c8: `pupitre` 85% lines pada `src/compiler`, `src/query`, `src/authz`; package lain tanpa gate di M1.
