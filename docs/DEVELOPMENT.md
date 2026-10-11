# Pupitre — Panduan Pengembangan

Cara menyiapkan, membangun, menguji, dan merilis monorepo `rikoriswandha/pupitre`. Konvensi mengikuti package AdonisJS v7 resmi dan `adonisjs-periscope`.

## 1. Prasyarat

- Node 24 (lihat `.nvmrc` / `mise.toml`), npm 11. TypeScript ~6.0, ESLint 10 (flat config root), Prettier `@adonisjs/prettier-config`.
- PostgreSQL 16+ untuk test matrix (opsional; default SQLite).
- Playwright browsers: `npx playwright install chromium`.

## 2. Layout repo

```
pupitre/
  package.json              # workspaces, scripts root
  tsconfig.base.json
  eslint.config.js          # @adonisjs/eslint-config + aturan batas import
  .github/workflows/        # ci.yml, release.yml, registry-check.yml
  docs/
  packages/
    pupitre/                # @rikology/pupitre (lihat ARCHITECTURE §2)
    pupitre-react/          # @rikology/pupitre-react
    pupitre-ui/             # @rikology/pupitre-ui + registry/
    pupitre-shield/         # M4
    pupitre-transmit/       # M4
    pupitre-audit/          # M4
    create-pupitre-plugin/  # M4
  apps/
    example/                # AdonisJS v7 + Inertia React host; dogfood & Playwright
  tools/
    registry-build/         # pupitre-ui sumber → registry.json
    verify-exports/
```

Workspace `packages/create-pupitre-plugin` berisi CLI `create-pupitre-plugin <name> [--dir <path>] [--force]`, API `createPlugin()`, dan `template/` terpublikasi. `node ace make:plugin <name>` membuat plugin lokal; `--package [--dir <path>]` menjalankan `npx --yes @rikology/create-pupitre-plugin@<major-core>` tanpa shell. Template menguji export build yang terpublikasi, tanpa condition `@rikology/source`. Manifest Ace diperbarui tanpa build dengan `node --conditions=@rikology/source --import=@poppinss/ts-exec packages/pupitre/scripts/generate_commands_manifest.ts --source`.

## 3. Setup

```bash
git clone git@github.com:rikoriswandha/pupitre.git && cd pupitre
npm install                 # satu lockfile root
npm run build               # tiga package inti (urutan: pupitre → pupitre-react → pupitre-ui)
npm test                    # Japa (+ Playwright CT di pupitre-ui) di semua workspace
npm run dev -w apps/example # host app memakai sumber TS package lewat kondisi export
```

Setiap entri `exports` package punya kondisi `"@rikology/source": "./<file>.ts"` sebelum `types`/`default`. Test dijalankan dengan `node --conditions=@rikology/source --import=@poppinss/ts-exec`, tsconfig memakai `customConditions: ["@rikology/source"]`, Vite (example app, Playwright CT) memasang kondisi yang sama di `resolve.conditions`, dan script `dev`/`test` example memasang `NODE_OPTIONS=--conditions=@rikology/source`. Hasilnya import lintas package selalu ke sumber TS (HMR lintas package, tanpa build) sementara konsumen npm hanya melihat `build/`. Example app memakai `PORT=3391` (3333/3340 dipakai app lain di mesin pengembang).

`node ace add @rikology/pupitre` memasang `@rikology/pupitre-react`, `@rikology/pupitre-ui`, Tailwind CSS v4, dan `@tailwindcss/vite`, mendaftarkan plugin Vite, serta menambahkan `@import '@rikology/pupitre-ui/styles.css';` ke `inertia/css/app.css` bila file tersebut tersedia. Host yang menyimpan CSS entry di lokasi lain perlu menambahkan import stylesheet itu ke entry yang dipakai Inertia/Vite sendiri.

## 4. Scripts root

| Script                              | Isi                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `build`                             | `npm run build -w packages/pupitre -w packages/pupitre-react -w packages/pupitre-ui`     |
| `typecheck`                         | `tsc --noEmit` per workspace (`npm run typecheck --workspaces`)                          |
| `lint` / `format`                   | eslint + prettier Adonis                                                                 |
| `test`                              | `npm test --workspaces --if-present`                                                     |
| `test:pg`                           | sama dengan `DB=pg` (butuh `DATABASE_URL`)                                               |
| `verify:exports`                    | import tiap subpath setiap package, assert bentuk                                        |
| `registry:build` / `registry:check` | M4 (WP40): bangun `packages/pupitre-ui/registry/registry.json`; `check` gagal kalau diff |
| `bundle:budget` | WP42: test gate + ukuran gzip/Brotli graph Vite, batas chunk lazy; jalankan sesudah build example |
| `e2e`                               | Playwright terhadap `apps/example`                                                       |
| `release`                           | `release-it` per package (lihat §9)                                                      |

WP40 tersedia: `registry:build` memindai sumber UI dan menulis manifest serta `registry/public/{registry.json,r/*.json}` secara deterministik; `registry:check` membangun ke direktori sementara, membandingkan artefak committed, lalu menjalankan test copy-ability semua item. Jalankan build dan commit hasil setelah mengubah komponen. Origin dependency dapat diganti dengan `PUPITRE_REGISTRY_URL=http://localhost:3404/r npm run registry:build` atau `node tools/registry-build/index.mjs --base-url http://localhost:3404/r --output /tmp/pupitre-registry`; jangan commit output origin lokal.

WP42: `verify:exports` juga menjalankan regresi parser import runtime, mengecek seluruh file JS build memakai dependency/peer yang dideklarasikan (devDependency tidak cukup), serta `npm pack --dry-run --json` untuk ketujuh package publishable. Tarball tidak boleh membawa `build/tmp`, test internal, coverage, atau registry source junk; test dalam `create-pupitre-plugin/template` memang diperlukan oleh generator. Fixture terisolasi dapat dicek dengan `node tools/verify-exports/index.mjs --package /path/to/package`.

Untuk budget: `npm run build` → `cd apps/example && node ace build --ignore-ts-errors` → kembali ke root dan `npm run bundle:budget`. Tool membaca `public/assets/.vite/manifest.json`, menjumlah kompresi per file tanpa duplikasi pada static closure entry `inertia/app.tsx`, mengukur CSS dan semua grup fitur berat, serta menolak fitur eager pada entry maupun halaman admin. Batas di `tools/bundle-budget/budgets.json` memiliki headroom 10%; jangan menaikkan batas tanpa mencatat pengukuran dan alasan di `RELEASE_1_0.md`. Argumen path JSON alternatif mendukung uji negatif tanpa mengubah budget committed.

Docs menyajikan `registry/public` pada root (`/registry.json`, `/r/<name>.json`). Host: `node ace pupitre:ui add select --yes`; target `registry:file` memakai `~/inertia/components/pupitre/` relatif terhadap root host. Flag `--path` tidak tersedia karena shadcn meratakan file; installer langsung mendukung `--cwd` untuk memilih root host. `--registry file:///path/to/registry/public` atau origin HTTP mendukung sumber lokal; dependency origin juga harus menunjuk server lokal. Smoke nyata: `node tools/registry-build/shadcn-smoke.mjs` menjalankan shadcn@4 pada fixture Vite/React/TS lalu `tsc --noEmit`; dependency npm prerelease disediakan dari workspace karena belum terpublikasi (target, isi file, dan graph registry tetap asli).

## 5. Konvensi package

Mengikuti skill `adonisjs-package-development`:

- `"type": "module"`, `"sideEffects": false`, `engines.node >= 24`.
- `peerDependencies`: `@adonisjs/core`, `@adonisjs/lucid`, `@adonisjs/inertia`, `@adonisjs/bouncer`, `@vinejs/vine`, `luxon`; optional (`peerDependenciesMeta`): `@adonisjs/queue`, `@adonisjs/transmit`, `@adonisjs/ally`, `@adonisjs/mail`, `@rikology/adonisjs-tenant`, `@rikology/adonisjs-notifications`, `@rikology/adonisjs-audit-trail`, `otplib`, `@simplewebauthn/server`.
- Optional peer **tidak pernah** di-import top-level; hanya di `src/drivers/*` lewat `await import()` dengan error peer yang jelas. Driver jobs tersedia melalui `jobsAdapter()` dari `@rikology/pupitre/drivers/queue`, dan dikonfigurasi dengan `defineConfig({ jobs: jobsAdapter() })`.
- Realtime WP39 berada di package `@rikology/pupitre-transmit`, dengan optional peers `@adonisjs/transmit` (server) dan `@adonisjs/transmit-client` (browser). Host mendaftarkan `@adonisjs/transmit/transmit_provider`, membuat `config/transmit.ts` (`pingInterval: false`, `transport: null` untuk satu proses), serta `transmit.registerRoutes((route) => route.use(middleware.auth()))`. Konfigurasikan `realtime: transmitRealtime()` di `config/pupitre.ts`; buat instance stabil `transmitRealtimeClient()` dari subpath `/client` dan pasang pada `<Pupitre realtime={client} />`. Import peer tetap lazy di adapter/client; core dan renderer tidak mengimpor transport. Tanpa konfigurasi server/client, polling tetap bekerja.
- `actions.export()` dan `actions.import()` CSV memakai `exports.maxSyncRows` (default 1.000); ekspor sampai ambang itu berjalan sinkron, ekspor lebih besar memakai jobs bila tersedia hingga `exports.maxAsyncRows` (default 100.000), dan tanpa adapter mengembalikan error limit. `exports.retentionMinutes` default 1.440. Handlers tetap `pupitre.export`, `pupitre.import`, dan `pupitre.bulk` diregistrasikan saat boot agar worker terpisah dapat menyelesaikan payload serializable. Import/bulk dapat memakai `.async()`; tanpa adapter keduanya tetap sinkron.
- Social login uses the optional `@adonisjs/ally` peer. Add `ally_provider` and `config/ally.ts` to the host; Pupitre loads the peer only when a configured social route is used. Provider email fallback requires Ally to report a verified email.
- `exports` dengan `@rikology/source` + `types` + `default` untuk setiap subpath:

```jsonc
{
  ".": {
    "@rikology/source": "./index.ts",
    "types": "./build/index.d.ts",
    "default": "./build/index.js",
  },
  "./catalog": "...",
  "./types": "...",
  "./pupitre_provider": "...",
  "./services/main": "...",
  "./commands": "...",
  "./commands/*": "...",
  "./middleware/*": "...",
  "./hooks": "./build/src/discovery/index_admin.js", // indexAdmin() untuk adonisrc
  "./drivers/*": "...",
  "./testing": "./build/testing/index.js" // assertion wire spec
}
```

`@rikology/pupitre-ui/testing` mengekspor fixture Playwright dari subpath terpisah; `@playwright/test` merupakan peer opsional sehingga tidak dimuat oleh entry utama package.

- Build: `tsdown` (`unbundle: true`, entry = semua subpath) → `tsc -p tsconfig.build.json` (deklarasi saja) → `copyfiles stubs/**/*.stub commands/commands.json build` + regenerasi manifest command.
- `pupitre-react` dan `pupitre-ui`: `tsdown` dengan `external: ['react', 'react-dom', '@inertiajs/react']`, JSX `react-jsx`, emit `.js` + `.d.ts`; **tanpa CSS** di `pupitre-react`; `pupitre-ui` mengekspor `styles.css` berisi `@source` Tailwind v4 untuk kelas yang dipakai.
- Tidak ada `index.ts` yang mengekspor segalanya di `pupitre-ui`: tiap komponen punya file sendiri agar tree-shake jalan; `components.ts` mengekspor map untuk registry.

## 6. Batas import (lint)

`eslint.config.js` memasang `no-restricted-imports` per workspace sesuai ARCHITECTURE §1. Contoh untuk `packages/pupitre`:

```js
{
  files: ['packages/pupitre/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['react', 'react-dom', 'react/*', '@inertiajs/*', '@json-render/react', '@rikology/pupitre-react', '@rikology/pupitre-ui'] }] }] }
}
```

Untuk `packages/pupitre/catalog/**`: hanya `zod` yang boleh. `pupitre-react` dan `pupitre-ui` hanya boleh menyentuh core lewat `@rikology/pupitre/catalog`; `pupitre-ui` tidak boleh mengimpor `@json-render/*`. Diperiksa juga oleh `verify:exports` yang memuat `build/catalog/index.js` dalam proses Node dengan resolve hook yang menolak semua import selain `zod`.

## 7. Konvensi kode

- Nama file `snake_case.ts` (Adonis), komponen React `PascalCase.tsx`.
- Import relatif memakai ekstensi `.js` (ESM Node).
- Builder: immutable — setiap method mengembalikan instance baru (`return this.clone({ ... })`) supaya definisi bisa dibagi dan di-hash deterministik.
- Closure di definition disimpan apa adanya; **jangan** memanggil closure di builder, hanya di compiler.
- Semua string UI yang kelak di-i18n lewat `t('...')` internal (identity function di v1) agar M-i18n tidak perlu grep ulang.
- Error class: `E_PUPITRE_*` di `src/errors.ts` memakai `@adonisjs/core/exceptions` `createError`.
- Log lewat `app.logger.child({ module: 'pupitre' })`.
- Schema editor: `s.markdownEditor(name).toolbar([...]).fileAttachments({ disk, directory })` menyimpan string Markdown; `s.codeEditor(name).language(...).lineNumbers().minHeight(...)` menyimpan source string, dengan Vine rules yang sama seperti input string. File image dapat mengaktifkan `.imageEditor().imageEditorAspectRatios([...])`; file hasil crop diunggah lagi ke endpoint Pupitre dan MIME/maxSize tetap ditegakkan server.
- Schema parity: `.tel().telRegex(regex)` dan `.url()` memvalidasi teks dengan VineJS; `.mask('99/99/9999')` hanya memformat input sehingga bound/dehydrate tetap raw. `s.textarea(name).autosize()` tumbuh dari `rows`; `s.slider(name).min().max().step().marks([...]).range()` mendukung angka atau tuple. `hintIcon(icon, { tooltip })`, `.hintColor()`, `.hintAction(action)`, `.prefixAction()` dan `.suffixAction()` masuk ke catalog/action protocol. Repeater Lucid `.relationship('hasManyName', { orderColumn })` menyinkronkan child records dalam transaksi parent dan menolak key asing.
- Schema Builder/Wizard: `s.builder('content').blocks([s.block('heading').label('Heading').schema((fields) => [fields.text('title').required()])])` menyimpan array block `{ _key, type, data }` pada kolom JSON model; `fields` memakai namespace block yang nama field-nya bukan kolom model. Setiap block divalidasi dengan schema Vine sesuai tipenya, dan `s.block()` immutable. `s.wizard([s.step('Account').schema([...])]).startOnStep(1).submitLabel('Finish')` menampilkan semua langkah ter-mount; validasi tetap di server dan 422 mengaktifkan langkah error pertama.

- Relation manager/hierarki resource (WP28): `defineRelationManager(Post, 'comments').table(...).form(...).actions({ header, row, bulk })`, `defineResource(Revision).parent(PostResource, 'post')` + `PostResource.nested([RevisionResource])`, dan `PostResource.relations([relationGroup('Content', [...])])`. `pages.list().modals()` menjaga create/edit resource sederhana di `ActionModal` tanpa mendaftarkan route halaman.
Pengujian host memakai `@rikology/pupitre/testing`: `visitResource(slug, page, { user, tenant?, query?, record?, panel? })` dan `visitPage(slug, { user })` mengembalikan page wire, `spec`, `state`, serta data; `submitForm` mengirim create/edit melalui controller resource dengan validasi VineJS dan mengembalikan `FormResult` (`assertErrors`, `assertOk`, `errors`, `record`); `runAction` melewati controller action dan menghasilkan `ActionResult` dengan validasi 422 serta penolakan forbidden yang mengikuti HTTP. Jalur ini memakai konteks HTTP test Adonis dan container aplikasi yang sudah boot.

## 8. CI

`ci.yml` (push/PR):

1. `npm ci` → `lint` → `typecheck`.
2. `test` (SQLite) matrix Node 24; job terpisah `test:pg` dengan service PostgreSQL.
3. `build` → `verify:exports`.
4. `registry:check` — mulai M4 (WP40).
5. `e2e` (Playwright, example app, SQLite) — artefak report saat gagal.

Langkah WP40 aktif di job `checks`, tepat sesudah `verify:exports`; perubahan sumber tanpa regenerasi JSON menyebabkan CI gagal dengan instruksi `npm run registry:build`.

| Gate WP42 pada job `checks` | Posisi | Kegagalan yang dideteksi |
| --- | --- | --- |
| `npm run bundle:budget` | Langsung setelah build example | Budget gzip/Brotli terlampaui, fitur berat tidak lazy, referensi manifest tidak lengkap |
| `npm run verify:exports` | Setelah test package | Import runtime tidak dideklarasikan/tidak resolve, tarball kotor, aset rilis hilang |

`release.yml` (`workflow_dispatch`, input `target`: `core` = `pupitre` + `pupitre-react` + `pupitre-ui` lockstep, atau satu plugin/scaffolder) menjalankan gerbang yang sama dengan CI (build, lint, typecheck, test, `verify:exports`, `registry:check`), lalu `npm publish --provenance` per workspace lewat npm trusted publishing (OIDC, tanpa token) dan mendorong tag `@rikology/<package>@x.y.z`. Versi tidak di-bump oleh workflow: bump dan CHANGELOG di-commit lebih dulu. Versi berisi `-` dipublikasikan dengan dist-tag `next`, selain itu `latest`.

## 9. Versi & rilis

- Semua package inti (`pupitre`, `pupitre-react`, `pupitre-ui`) dirilis **lockstep** dengan versi sama; `pupitre-react`, `pupitre-ui`, dan plugin resmi mendeklarasikan `peerDependencies: { "@rikology/pupitre": "^<major>.0.0" }` yang di-bump bersama versi (npm workspaces tidak mengenal protokol `workspace:`; link lokal terjadi otomatis selama range cocok). Plugin berversi sendiri.
- `catalogVersion` = `major.minor` package.
- Pre-release M1–M3: `0.x.0-beta.x` dengan tag npm `next`. Rilis 1.0 (M4): semua package `1.0.0` (inti lockstep; plugin resmi dan scaffolder mulai di `1.0.0` lalu berversi sendiri), `catalogVersion` `1.0`, range peer antar package `^1.0.0`.
- Conventional Commits; scope = nama package (`feat(react): ...`, `fix(ui): ...`, `docs:`).

## 10. Example app

`apps/example` adalah host AdonisJS v7 + Inertia React (starter kit) yang sudah menjalankan `node ace add @rikology/pupitre` (hasilnya di-commit). Isi: model `User`, `Post`, `Category`, `Comment`, `Tag`, `Revision`, `Tenant`; policy; seeder deterministik (`node ace db:seed`); panel `admin` (tenancy url) dan `app` (tanpa tenancy). Post menampilkan relation manager Comments (`hasMany`) dan Tags (`manyToMany`, pivot note), serta nested Revisions; Tags memakai halaman list dengan create/edit modal. Dipakai oleh Playwright dan sebagai referensi dokumentasi — setiap fitur baru wajib tampil di sini.
Contoh Post memakai kolom `summary` (ditambah migrasi contoh idempotent) untuk `MarkdownEditor` dan `TextEntry.markdown()`; field `body` tetap memakai `RichEditor` HTML. Halaman Settings menunjukkan `CodeEditor` JSON, dan cover Post mengaktifkan editor crop gambar.

```bash
cd apps/example && cp .env.example .env && node ace migration:fresh --seed && npm run dev
# login: admin@example.com / password
```

## 11. Debugging

- `node ace pupitre:routes` — menampilkan route dan namanya.
- `node ace pupitre:prune` — menghapus token reset password dan file/row export yang sudah kedaluwarsa; jadwalkan command ini sesuai kebijakan host.

`node ace make:page Settings` membuat `app/admin/pages/settings_page.ts`; `node ace make:widget PostsByStatus --type=stats|chart|table` membuat `app/admin/widgets/posts_by_status_widget.ts`. File generator tidak menimpa keluaran yang sudah ada; gunakan `--force` untuk overwrite. `indexAdmin()` menemukan suffix `_page` dan `_widget` dan menerbitkan barrel terkait. Widget dapat didaftarkan ke panel atau resource page melalui `.widgets([...])`; custom page dapat memakai `definePage(...).widgets([...]).filters([...])`. Table widget harus memilih model terdaftar dan mendefinisikan schema/query melalui `defineWidget('latest-posts', Post).table((t) => t.query((query) => query.where(...)).columns([...]))`; sorting, pagination, dan format cell memakai pipeline tabel resource yang sama.

- `node ace make:panel <name> [--path /prefix] [--guard web]` — membuat `app/admin/panels/<name>.ts`; file yang sudah ada tidak ditimpa.
- `node ace make:resource Comment [--model=#models/comment] [--from-migration] [--force]` — membuat `app/admin/resources/comment_resource.ts` dari metadata Lucid (`$columnsDefinitions`, tipe deklarasi model/schema, enum dan belongsTo). Gunakan `--from-migration` saat model tidak mendeklarasikan tipe kolom. File yang sudah ada dilewati kecuali `--force`; relasi selain belongsTo dilewati dan dilaporkan.
- `node ace pupitre:inspect [resource] [--json]` — policy/ability report, hasil lift closure tiap field (`expression`, `computed`, `static`, `server`) dan kolom searchable tanpa indeks (SQLite `PRAGMA index_list/index_info`, PostgreSQL `pg_indexes`). JSON memuat laporan yang sama; action modal forms tidak dievaluasi oleh endpoint server.
- Di client: `window.__pupitre` (hanya dev) mengekspos store dan spec aktif.

## Dokumentasi pengguna (WP41)

`apps/docs` memakai Astro 7 dan Starlight 0.42, bahasa Inggris, dengan `site: https://pupitre.dev` dan output statis `dist/`. Jalankan `npm run dev -w apps/docs`, `npm run check -w apps/docs`, dan `npm run build -w apps/docs`; preview lokal: `npm run preview -w apps/docs -- --port 4321`.

Hook npm `predev`/`precheck`/`prebuild` menjalankan `scripts/prepare-content.mjs`: reference API dibentuk dari deklarasi TypeScript sumber menggunakan parser TypeScript, dan halaman changelog mengimpor seluruh `packages/*/CHANGELOG.md`. File hasil ini diabaikan Git; jangan diedit manual. Panduan, landing, CLI dan migrasi Filament ada di `src/content/docs/`.

Build docs mensyaratkan registry hasil WP40 di `packages/pupitre-ui/registry/public/r/`; hook Astro menyalin payload ke `dist/r/` dan index publik ke `dist/registry.json`. Registry belum dihasilkan menyebabkan build gagal dengan pesan eksplisit. Deploy seluruh `dist/` agar dokumentasi dan endpoint registry `/r/<name>.json` tersedia bersama.
