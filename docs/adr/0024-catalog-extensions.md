# ADR-0024: Catalog yang dapat diperluas oleh host dan plugin

- Status: Accepted
- Tanggal: 2026-10-12

## Konteks

Catalog inti mengikat nama komponen dan schema props antara compiler server dan renderer React. Sebelumnya host dapat mengganti komponen bawaan atau memakai view khusus, tetapi tidak dapat membuat field, column, dan entry bertipe dengan validasi server tanpa mengubah core. Plugin juga memerlukan cara mengumumkan metadata komponen tanpa membawa React atau Vine ke subpath catalog yang hanya boleh bergantung pada Zod.

## Keputusan

Tambahkan `defineCatalogExtension({ name, components })` pada `@rikology/pupitre/catalog`, dengan metadata kind field/column/entry dan props Zod. `mergeCatalogExtensions` menggabungkan definition dengan catalog inti dan menghapus kind dari definition json-render. Factory server `defineField`, `defineColumn`, dan `defineEntry` menerima extension, nama komponen, dan map method bertipe yang mengembalikan patch props; field menerima callback Vine `validate(props)` serta dehydrate opsional. Factory dipanggil langsung dan immutable. Plugin menyumbangkan `catalog: [extension]`, dan host browser mendaftarkan komponen melalui `defineRegistry(components, { extensions })`. Nama komponen atau kind yang bertabrakan ditolak, bukan menimpa definition diam-diam. Validasi payload tetap berasal dari definition server.

## Alternatif yang ditolak

- Menambah setiap field domain ke core: memperbesar catalog dan memasangkan release framework dengan kebutuhan tiap host.
- Menggunakan `schema.view()` untuk semua ekstensi: tidak menyediakan kontrak field, validasi Vine, binding repeater, atau rendering column/entry secara menyeluruh.
- Mengimpor builder server ke browser: melanggar batas package dan membawa dependensi Adonis/Lucid/Vine ke bundle client.
- Mendaftarkan namespace global `schema.rating`: menambah mutable state global dan menyamarkan kepemilikan factory. Import langsung `rating('rating')` lebih eksplisit.

## Konsekuensi

Host memiliki modul catalog bersama, factory server, dan komponen React terpisah. Plugin metadata bukan pemasangan komponen browser otomatis; kedua sisi harus memakai catalog yang sama. Zod memeriksa props khusus, sedangkan Vine memeriksa input user pada resource, action, dan repeater. Runtime column/entry memakai komponen ekstensi, tanpa mengubah otorisasi atau tenancy. Contoh Comments menyediakan rating dan criteria JSON dengan migrasi idempotent SQLite/PostgreSQL; E2E mencakup keyboard, target 24px, persistensi create/edit/view/table, modal, nested repeater, serta payload palsu di luar batas. Perubahan kontrak props tetap tunduk pada aturan evolusi catalog.
