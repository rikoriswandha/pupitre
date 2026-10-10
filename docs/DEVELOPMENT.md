# Pupitre — Panduan Pengembangan

Cara menyiapkan, membangun, menguji, dan merilis monorepo `rikoriswandha/pupitre`. Konvensi mengikuti package AdonisJS v7 resmi dan `adonisjs-periscope`.

## 1. Prasyarat

- Node 24 (lihat `.nvmrc` / `mise.toml`), npm 11.
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

## 3. Setup

```bash
git clone git@github.com:rikoriswandha/pupitre.git && cd pupitre
npm install                 # satu lockfile root
npm run build               # semua package (urutan: catalog → pupitre → react → ui)
npm test                    # Japa di semua package
npm run dev -w apps/example # host app memakai workspace link (bukan build), via tsconfig paths
```

Example app mengimpor package dari `packages/*/index.ts` saat dev lewat `paths` di `apps/example/tsconfig.json` dan `resolve.alias` Vite, sehingga HMR bekerja lintas package. Build produksi example memakai `build/` biasa.

## 4. Scripts root

| Script | Isi |
| --- | --- |
| `build` | `npm run build --workspaces --if-present` (urutan dari `workspaces` array) |
| `typecheck` | `tsc -b` dengan project references |
| `lint` / `format` | eslint + prettier Adonis |
| `test` | `npm test --workspaces --if-present` |
| `test:pg` | sama dengan `DB=pg` (butuh `DATABASE_URL`) |
| `verify:exports` | import tiap subpath setiap package, assert bentuk |
| `registry:build` / `registry:check` | bangun `packages/pupitre-ui/registry/registry.json`; `check` gagal kalau diff |
| `e2e` | Playwright terhadap `apps/example` |
| `release` | `release-it` per package (lihat §9) |

## 5. Konvensi package

Mengikuti skill `adonisjs-package-development`:

- `"type": "module"`, `"sideEffects": false`, `engines.node >= 24`.
- `peerDependencies`: `@adonisjs/core`, `@adonisjs/lucid`, `@adonisjs/inertia`, `@adonisjs/bouncer`, `@vinejs/vine`, `luxon`; optional (`peerDependenciesMeta`): `@adonisjs/queue`, `@adonisjs/transmit`, `@adonisjs/ally`, `@adonisjs/mail`, `@rikology/adonisjs-tenant`, `@rikology/adonisjs-notifications`, `@rikology/adonisjs-audit-trail`, `otplib`, `@simplewebauthn/server`.
- Optional peer **tidak pernah** di-import top-level; hanya di `src/drivers/*` lewat `await import()` dengan error peer yang jelas.
- `exports` dengan `types` + `default` untuk setiap subpath:

```jsonc
{
  ".": "./build/index.js",
  "./catalog": "./build/catalog/index.js",
  "./testing": "./build/src/testing/index.js",
  "./drivers/tenant": "./build/src/drivers/tenant.js",
  "./drivers/notifications": "...", "./drivers/queue": "...", "./drivers/audit": "...",
  "./pupitre_provider": "./build/providers/pupitre_provider.js",
  "./services/main": "./build/services/main.js",
  "./commands": "./build/commands/main.js",
  "./middleware/*": "./build/src/http/middleware/*.js",
  "./types": "./build/src/types.d.ts"
}
```

- Build: `tsdown` (entry = semua subpath) → `tsc --emitDeclarationOnly` → `copyfiles stubs/**/*.stub commands/commands.json build`.
- `pupitre-react` dan `pupitre-ui`: `tsdown` dengan `external: ['react', 'react-dom', '@inertiajs/react']`, JSX `react-jsx`, emit `.js` + `.d.ts`; **tanpa CSS** di `pupitre-react`; `pupitre-ui` mengekspor `styles.css` berisi `@source` Tailwind v4 untuk kelas yang dipakai.
- Tidak ada `index.ts` yang mengekspor segalanya di `pupitre-ui`: tiap komponen punya file sendiri agar tree-shake jalan; `components.ts` mengekspor map untuk registry.

## 6. Batas import (lint)

`eslint.config.js` memasang `no-restricted-imports` per workspace sesuai ARCHITECTURE §1. Contoh untuk `packages/pupitre`:

```js
{
  files: ['packages/pupitre/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', '@inertiajs/*', '@json-render/react', '@rikology/pupitre-react', '@rikology/pupitre-ui'] }] }
}
```

Untuk `packages/pupitre/catalog/**`: hanya `zod` yang boleh. Diperiksa juga oleh `verify:exports` yang mengimpor `@rikology/pupitre/catalog` di Node tanpa React terpasang (test tersendiri dengan `node --conditions`).

## 7. Konvensi kode

- Nama file `snake_case.ts` (Adonis), komponen React `PascalCase.tsx`.
- Import relatif memakai ekstensi `.js` (ESM Node).
- Builder: immutable — setiap method mengembalikan instance baru (`return this.clone({ ... })`) supaya definisi bisa dibagi dan di-hash deterministik.
- Closure di definition disimpan apa adanya; **jangan** memanggil closure di builder, hanya di compiler.
- Semua string UI yang kelak di-i18n lewat `t('...')` internal (identity function di v1) agar M-i18n tidak perlu grep ulang.
- Error class: `E_PUPITRE_*` di `src/errors.ts` memakai `@adonisjs/core/exceptions` `createError`.
- Log lewat `app.logger.child({ module: 'pupitre' })`.

## 8. CI

`ci.yml` (push/PR):

1. `npm ci` → `lint` → `typecheck`.
2. `test` (SQLite) matrix Node 24; job terpisah `test:pg` dengan service PostgreSQL.
3. `build` → `verify:exports`.
4. `registry:check`.
5. `e2e` (Playwright, example app, SQLite) — artefak trace saat gagal.

`release.yml` (`workflow_dispatch`, input package + bump): `release-it` dengan `@release-it/conventional-changelog`, publish via npm trusted publishing (OIDC, tanpa token), tag `@rikology/pupitre@x.y.z`.

## 9. Versi & rilis

- Semua package inti (`pupitre`, `pupitre-react`, `pupitre-ui`) dirilis **lockstep** dengan versi sama; `pupitre-react` mendeklarasikan `peerDependencies: { "@rikology/pupitre": "^<versi saat ini>" }` yang di-bump oleh script rilis (npm workspaces tidak mengenal protokol `workspace:`; link lokal terjadi otomatis selama range cocok). Plugin berversi sendiri.
- `catalogVersion` = `major.minor` package.
- Pre-release M1: `0.1.0-beta.x` dengan tag npm `next`.
- Conventional Commits; scope = nama package (`feat(react): ...`, `fix(ui): ...`, `docs:`).

## 10. Example app

`apps/example` adalah host AdonisJS v7 + Inertia React (starter kit) yang sudah menjalankan `node ace add @rikology/pupitre` (hasilnya di-commit). Isi: model `User`, `Post`, `Category`, `Comment`, `Tenant`; policy; seeder deterministik (`node ace db:seed`); panel `admin` (tenancy url) dan `app` (tanpa tenancy). Dipakai oleh Playwright dan sebagai referensi dokumentasi — setiap fitur baru wajib tampil di sini.

```bash
cd apps/example && cp .env.example .env && node ace migration:fresh --seed && npm run dev
# login: admin@example.com / password
```

## 11. Debugging

- `node ace pupitre:inspect posts` — closure lifting, policy, index.
- `node ace pupitre:routes` — route + nama.
- `PUPITRE_DEBUG=1` — spec yang dikirim dicetak ke log dan di-`validateSpec`.
- Di client: `window.__pupitre` (hanya dev) mengekspos store dan spec aktif.
