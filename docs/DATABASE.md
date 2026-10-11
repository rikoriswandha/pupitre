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

Challenges WebAuthn disimpan di session (bukan DB), berumur lima menit, dan dikonsumsi saat verifikasi dicoba. Assertion valid memperbarui `counter`, `last_used_at`, `backed_up`, dan `device_type`.

### `pupitre_exports` (M3, WP30) — dipakai ketika adapter `jobs` dikonfigurasi

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
| `result` | text nullable | Ringkasan JSON import asynchronous (`created`, `updated`, `failed`, `failedRowsUrl`). |
| `created_at`, `updated_at`, `expires_at` | timestamptz | file dihapus setelah `expires_at` |

Tabel dipublikasikan oleh stub migrasi `1791700000006_create_pupitre_exports_table` dan boleh tetap kosong bila host tidak memakai `jobs`; ekspor sinkron tidak membuat row. `user_id` memakai FK `users.id` (integer), `tenant_id` menyimpan ID tenant aktif tanpa FK karena model tenant milik host. Retensi default 1.440 menit dapat diubah lewat `config/pupitre.ts` → `exports.retentionMinutes`; `pupitre:prune` menghapus file dari disk storage sebelum menghapus row kedaluwarsa.

### Shield (M4, WP37) — tabel global plugin `@rikology/pupitre-shield`

| Tabel | Kolom | Tipe / batasan |
| --- | --- | --- |
| `pupitre_roles` | `id` | increments, primary key |
| `pupitre_roles` | `name` | string(160), wajib, unique |
| `pupitre_roles` | `created_at`, `updated_at` | timestamp, wajib; otomatis oleh model Lucid |
| `pupitre_permissions` | `id` | increments, primary key |
| `pupitre_permissions` | `name` | string(254), wajib, unique; `<slug>.<ability>` |
| `pupitre_permissions` | `created_at`, `updated_at` | timestamp, wajib; otomatis oleh model Lucid |
| `pupitre_permission_role` | `role_id` | integer FK `pupitre_roles.id`, cascade |
| `pupitre_permission_role` | `permission_id` | integer FK `pupitre_permissions.id`, cascade |
| `pupitre_role_user` | `role_id` | integer FK `pupitre_roles.id`, cascade |
| `pupitre_role_user` | `user_id` | integer FK `users.id` host, cascade |

Kedua pivot memakai primary key komposit pasangan FK, tanpa kolom timestamp. Configure menerbitkan `1791700000037_create_pupitre_shield_tables.ts`; `--user-table=accounts` mengganti tabel FK host. Tipe `user_id`/kolom referensi harus disesuaikan sebelum migrasi untuk host UUID/custom PK. Role dan permission bersifat global lintas panel/guard, bukan tenant-scoped; slug yang sama berbagi grant. Lookup memakai satu query join per request/user. `shield:sync --user=<id|email>` melakukan upsert permission dan assignment super-admin secara idempotent.

`shieldRolesField()` mengisi ID role saat edit dan menyinkronkan pivot dalam transaksi create/update; daftar kosong mencabut assignment. Field tersembunyi untuk actor tanpa `roles.viewAny`, sehingga form User tetap dapat dibuka tanpa membaca opsi role atau mengubah pivot melalui input tersembunyi.

## 2. Kolom yang ditambahkan ke `users` host

Migrasi `add_pupitre_columns_to_users` memakai `hasColumn` sebelum setiap `alter` dan hanya menambahkan kolom M2 Pupitre berikut (kolom kredensial standar tetap tanggung jawab host):

| Kolom | Tipe | Fitur | Wajib? |
| --- | --- | --- | --- |
| `email_verified_at` | timestamptz nullable | email verification | kalau `.emailVerification()` |
| `avatar` | string nullable | key storage adapter | kalau profile avatar aktif |
| `timezone` | string(64) nullable | override timezone panel | opsional; dibaca kalau ada |
| `current_tenant_id` | integer nullable | tenancy mode `implicit` | kalau tenancy implicit tanpa `adonisjs-tenant` |
| `provider` | string nullable | Ally provider key; optional social identity lookup | migration WP32b |
| `provider_id` | string nullable | provider's stable account id; paired with `provider` | migration WP32b |
| `mfa_secret` | text nullable | encrypted TOTP secret | kalau `.mfa()` |
| `mfa_recovery_codes` | text nullable | JSON array of per-code SHA-256 hashes | kalau `.mfa()` |
| `mfa_enabled_at` | timestamptz nullable | MFA activation timestamp | kalau `.mfa()` |

Untuk `.login()` host harus menyediakan kolom email dan password pada model, serta model auth yang mengimplementasikan `verifyCredentials(email, password)` (umumnya `withAuthFinder`). `auth.columns` berisi **nama properti model Lucid**, bukan nama fisik SQL. Perubahan email/password profil memerlukan password saat ini; avatar harus berupa image dan disimpan sebagai key pada storage disk Pupitre.

Social login memakai kolom identitas hanya bila keduanya tersedia; selain itu akun dicocokkan melalui email terverifikasi dari provider. Stub migrasi kolom sosial `1791700000005_add_pupitre_social_columns_to_users` dipublikasikan saat configure. Callback hanya memakai target relatif yang sebelumnya disimpan di session; parameter query callback tidak diteruskan ke redirect setelah login. Ally melaporkan status verified untuk GitHub saat provider mengembalikan email publik/terverifikasi dan untuk Google pada alamat yang telah diverifikasi oleh Google; alamat kosong, unsupported, atau unverified tidak pernah dipakai untuk menghubungkan akun atau registrasi. `auth.columns.socialProvider` dan `socialProviderId` memetakan properti model Lucid (default `provider` dan `providerId`).

Nama kolom bisa diubah di `config/pupitre.ts` → `auth.columns`. Properti `emailVerifiedAt`, `avatar`, `timezone`, dan lainnya dibaca melalui atribut model sesuai konfigurasi; migrasi hanya menambahkan kolom fisik standar di atas.

Panel tenancy dikonfigurasi lewat `.tenancy({ mode, model, ownership, tenantsForUser })`. Driver kolom default membutuhkan `model` tenant dan callback `tenantsForUser(user, ctx)` yang hanya mengembalikan tenant tempat user menjadi anggota; Pupitre menolak anggota yang tidak ada pada hasil callback. `ownership` default `tenant_id` harus berupa kolom nyata pada tiap tabel resource yang terscope. Mode `implicit` juga membutuhkan kolom user yang dapat ditulis pada `currentTenantAttribute` (default `currentTenantId`) untuk menyimpan pilihan aktif. `scope(false)` menandai resource global yang sengaja tidak memiliki tenancy.

Pupitre tidak membuat tabel tenant atau membership. Host menyediakan tenant model, relasi/pivot membership, ownership columns dan indeks tenant-leading sesuai access path. Driver opsional `@rikology/pupitre/drivers/tenant` memakai konteks `TenantService` dan `TenantScope` dari `@rikology/adonisjs-tenant`; kolom ownership Pupitre tetap diterapkan untuk model tanpa mixin.

## 3. Kolom yang diasumsikan pada model resource

| Fitur builder | Kolom | Catatan |
| --- | --- | --- |
| tenancy default (`ownership`) | `tenant_id` | nama bisa diubah per panel/resource |
| `.softDeletes('deletedAt')` | `deleted_at` | Implementasi Pupitre sendiri (tanpa `lucid-soft-deletes`): `scopedQuery()` menerapkan `whereNull` secara default; filter trashed memilih `with`/`only`, delete mengisi timestamp, restore mengosongkan kolom. |
| `.reorderable('sortOrder')` | `sort_order` integer | |
| `t.text('x').searchable()` | index disarankan; `pupitre:inspect` memperingatkan kolom `searchable` tanpa index (PostgreSQL: `pg_indexes`) |
| `recordTitle` | kolom apa pun | |

`s.repeater('items').relationship('items', { orderColumn })` memakai tabel child Lucid milik host (`hasMany`); Pupitre tidak membuat tabel relasi generik. Form menyimpan PK child sebagai state internal saat edit, lalu dalam transaksi parent membuat/memperbarui/menghapus hanya child yang ditemukan lewat query relasi parent. `orderColumn` (nama atribut model child) menerima indeks urutan dari repeater.
`defineRelationManager(Model, relation)` memakai tabel/model child atau pivot yang sudah didefinisikan host; Pupitre tidak membuat tabel generik. `.nested([...])`/`.parent(Post, 'post')` juga reuse FK Lucid dan membatasi query child ke parent. Aksi dissociate membutuhkan FK hasMany nullable; pada example `comments.post_id` nullable dan `comments.tenant_id` di-backfill dari `posts.tenant_id`. Example tags memakai `tags.tenant_id`, pivot `post_tags(post_id, tag_id, note)`, dan child `revisions(post_id, tenant_id)`.

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

## 7. Audit trail (M4, WP38)

`pupitre-audit` tidak membuat tabel log sendiri. Activity memakai model `Audit` dari `@rikology/adonisjs-audit-trail`; tabel `audits` menyimpan UUID `id`, event, pasangan `auditable_type/auditable_id`, `old_values/new_values` JSON, actor, `tenant_id`, tags, waktu, serta `stream/seq/hash/prev_hash`. Migrasi example mengikuti skema peer termasuk tabel checkpoint/archive dan guard maintenance SQLite. Semua builder DDL queued tanpa `await`.

Post example memakai mixin `Auditable(PostSchema)`. Provider/config peer menangani capture dan delivery; `config.pupitre.audit` hanya adapter pembacaan. Activity tidak menyediakan operasi tulis; list dan detail dibatasi tenant aktif melalui `tenant_id` meskipun ownership column resource host berbeda.
