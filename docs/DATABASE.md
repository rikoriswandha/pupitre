# Pupitre — Skema Database

Pupitre memiliki sedikit tabel sendiri. Semua yang bisa diambil dari package `@rikology/adonisjs-*` tidak diduplikasi. Migrasi dipublikasikan ke host saat `node ace add @rikology/pupitre` (stub dengan timestamp 13 digit saat dibuat) dan idempotent (`hasTable`/`hasColumn` guard) untuk SQLite dan PostgreSQL.

## 1. Tabel milik Pupitre

### `pupitre_password_resets` (M2, WP17)

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | increments | |
| `user_id` | integer/uuid FK `users.id` on delete cascade | tipe mengikuti `users.id` host (stub mendeteksi dari model `User`) |
| `guard` | string(50) | guard panel; satu user bisa punya token per guard |
| `token_hash` | string(64) unique | SHA-256 dari token mentah; token mentah hanya ada di email |
| `expires_at` | timestamptz | default +60 menit |
| `created_at` | timestamptz | |

Index: `(user_id, guard)`. Token lama user yang sama dihapus saat token baru dibuat. Pembersihan kedaluwarsa: command `pupitre:prune` (dijadwalkan host) atau saat verifikasi.

### `pupitre_passkeys` (M3, WP32)

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | increments | |
| `user_id` | FK `users.id` cascade | |
| `credential_id` | string(512) unique | base64url |
| `public_key` | text | COSE base64url |
| `counter` | bigint | anti-clone |
| `transports` | json | `['internal','hybrid']` |
| `device_type` | string(32) | `singleDevice`/`multiDevice` |
| `backed_up` | boolean | |
| `name` | string(100) nullable | label user |
| `last_used_at` | timestamptz nullable | |
| `created_at`, `updated_at` | timestamptz | |

Challenge WebAuthn disimpan di session (bukan DB).

### `pupitre_exports` (M3, WP30) — hanya kalau adapter `jobs` dipasang

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | job id yang dikembalikan ke client |
| `user_id` | FK | |
| `tenant_id` | nullable | |
| `resource` | string | slug |
| `status` | enum `queued/processing/done/failed` | |
| `total_rows`, `processed_rows` | integer | progress |
| `file_key` | string nullable | key di storage adapter |
| `error` | text nullable | |
| `created_at`, `updated_at`, `expires_at` | timestamptz | file dihapus setelah `expires_at` |

Tanpa adapter `jobs`, export sinkron dan tabel ini tidak dibuat.

## 2. Kolom yang ditambahkan ke `users` host

Migrasi `add_pupitre_columns_to_users` memakai `hasColumn` sebelum setiap `alter` dan hanya menambahkan kolom M2 Pupitre berikut (kolom kredensial standar tetap tanggung jawab host):

| Kolom | Tipe | Fitur | Wajib? |
| --- | --- | --- | --- |
| `email_verified_at` | timestamptz nullable | email verification | kalau `.emailVerification()` |
| `avatar` | string nullable | key storage adapter | kalau profile avatar aktif |
| `timezone` | string(64) nullable | override timezone panel | opsional; dibaca kalau ada |
| `current_tenant_id` | integer nullable | tenancy mode `implicit` | kalau tenancy implicit tanpa `adonisjs-tenant` |

Untuk `.login()` host harus menyediakan kolom email dan password pada model, serta model auth yang mengimplementasikan `verifyCredentials(email, password)` (umumnya `withAuthFinder`). `auth.columns` berisi **nama properti model Lucid**, bukan nama fisik SQL. Perubahan email/password profil memerlukan password saat ini; avatar harus berupa image dan disimpan sebagai key pada storage disk Pupitre.

Nama kolom bisa diubah di `config/pupitre.ts` → `auth.columns`. Properti `emailVerifiedAt`, `avatar`, `timezone`, dan lainnya dibaca melalui atribut model sesuai konfigurasi; migrasi hanya menambahkan kolom fisik standar di atas.

Panel tenancy dikonfigurasi lewat `.tenancy({ mode, model, ownership, tenantsForUser })`. Driver kolom default membutuhkan `model` tenant dan callback `tenantsForUser(user, ctx)` yang hanya mengembalikan tenant tempat user menjadi anggota; Pupitre menolak anggota yang tidak ada pada hasil callback. `ownership` default `tenant_id` harus berupa kolom nyata pada tiap tabel resource yang terscope. Mode `implicit` juga membutuhkan kolom user yang dapat ditulis pada `currentTenantAttribute` (default `currentTenantId`) untuk menyimpan pilihan aktif. `scope(false)` menandai resource global yang sengaja tidak memiliki tenancy.

Pupitre tidak membuat tabel tenant atau membership. Host menyediakan tenant model, relasi/pivot membership, ownership columns dan indeks tenant-leading sesuai access path. Driver opsional `@rikology/pupitre/drivers/tenant` memakai konteks `TenantService` dan `TenantScope` dari `@rikology/adonisjs-tenant`; kolom ownership Pupitre tetap diterapkan untuk model tanpa mixin.

## 3. Kolom yang diasumsikan pada model resource

| Fitur builder | Kolom | Catatan |
| --- | --- | --- |
| tenancy default (`ownership`) | `tenant_id` | nama bisa diubah per panel/resource |
| `.softDeletes()` | `deleted_at` | memakai `@adonisjs/lucid-soft-deletes` kalau model memakainya, atau filter manual `whereNull` |
| `.reorderable('sortOrder')` | `sort_order` integer | |
| `t.text('x').searchable()` | index disarankan; `pupitre:inspect` memperingatkan kolom `searchable` tanpa index (PostgreSQL: `pg_indexes`) |
| `recordTitle` | kolom apa pun | |

## 4. Tabel dari peer (tidak dibuat Pupitre)

| Fitur | Package | Tabel |
| --- | --- | --- |
| Database notifications / inbox | `@rikology/adonisjs-notifications` | `notifications` |
| Audit timeline (`pupitre-audit`) | `@rikology/adonisjs-audit-trail` | `audit_logs` |
| Tenants / memberships | `@rikology/adonisjs-tenant` | sesuai package; Pupitre hanya memanggil resolver + `listForUser` |
| Roles & permissions | `@rikology/pupitre-shield` (plugin) | `pupitre_roles`, `pupitre_permissions`, `pupitre_role_user`, `pupitre_permission_role` |
| Sessions, remember-me | `@adonisjs/session`, `@adonisjs/auth` | milik host |

Catatan: Pupitre tidak mengelola atau memigrasikan tabel `notifications`. Host harus mendaftarkan provider dan migrasi peer; adapter Pupitre hanya membaca/menulis inbox milik user saat ini. Tanpa `config.pupitre.notifications`, tray dan endpoint inbox tidak tersedia dan notifikasi aksi tetap menjadi flash saja.

## 5. Cross-dialect

- Timestamp: `timestamp({ useTz: true })` → `timestamptz` di PostgreSQL, `datetime` di SQLite; Luxon membaca sebagai UTC.
- JSON: `json` di PostgreSQL = `jsonb`; SQLite = text, model memakai `prepare/consume` JSON.
- Enum: simpan string + validasi VineJS, bukan tipe enum PostgreSQL (migrasi enum sulit di-alter).
- Migrasi `alter` dibungkus guard `hasColumn`; **tidak** memakai `this.defer` yang menunda DDL (lihat masalah ganda-DDL Lucid pada queued schema).
- Index unik `token_hash`, `credential_id` dibuat eksplisit dengan nama (`pupitre_password_resets_token_hash_unique`) agar rollback bisa menghapusnya di kedua dialek.

## 6. Rollback

Setiap migrasi `down()` menghapus tabel/kolom yang dibuatnya **saja**; tidak menyentuh tabel peer. Urutan rollback: `pupitre_exports` → `pupitre_passkeys` → `pupitre_password_resets` → kolom `users` (FK `current_tenant_id` dilepas dulu untuk SQLite).
