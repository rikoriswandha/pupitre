# Pupitre — Dokumentasi

Admin panel Filament-like untuk AdonisJS v7 + Inertia React. Dokumen di folder ini adalah bahan kerja implementasi; dokumentasi pengguna akhir akan tinggal di `pupitre.dev` (M4).

| Dokumen | Isi | Baca saat |
| --- | --- | --- |
| [DESIGN.md](./DESIGN.md) | Design doc v0: ringkasan keputusan, builder API, compiler, runtime, roadmap, risiko | Pertama kali; sumber kebenaran untuk *apa* |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Batas package, modul internal, alur request, compiler/cache, invarian | Sebelum menulis kode di package mana pun |
| [WIRE_PROTOCOL.md](./WIRE_PROTOCOL.md) | Kontrak server ↔ client: props Inertia, state model, action descriptor, tabel, endpoint `/_pupitre/*`, route, error | Mengerjakan controller, bridge, atau komponen domain |
| [CATALOG.md](./CATALOG.md) | Daftar komponen catalog + props Zod, actions, fungsi `$computed`, aturan evolusi | Menambah/mengubah komponen, menulis registry host |
| [SPIKE_M0.md](./SPIKE_M0.md) | Rencana spike json-render: lima kriteria lulus, langkah, fallback, tempat hasil | Minggu pertama |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Work package M0–M4 dengan dependensi dan kriteria selesai | Memilih pekerjaan berikutnya, membuat PR |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Setup monorepo, konvensi package/kode, lint batas import, CI, rilis, example app | Onboarding, menyiapkan repo |
| [TESTING.md](./TESTING.md) | Lapis pengujian, apa yang wajib diuji per WP, helper publik `@rikology/pupitre/testing` | Menulis test |
| [DATABASE.md](./DATABASE.md) | Tabel milik Pupitre, kolom tambahan `users`, asumsi kolom resource, tabel peer, cross-dialect | Menulis migrasi/stub |
| [FILAMENT_PARITY.md](./FILAMENT_PARITY.md) | Checklist fitur Filament v4 → API Pupitre → milestone → status | Gate M3; review scope |
| [adr/](./adr/) | Architecture Decision Records 0001–0012 | Saat ingin mengubah keputusan: tulis ADR baru yang mensupersede |

## Urutan kerja yang disarankan

1. SPIKE_M0 → isi §7, perbarui status ADR-0001.
2. IMPLEMENTATION_PLAN WP1 (repo) mengikuti DEVELOPMENT.
3. WP2–WP16 berurutan sesuai graf dependensi; tiap WP memperbarui WIRE_PROTOCOL/CATALOG/DATABASE bila berdampak dan mencentang FILAMENT_PARITY.

## Perbedaan yang disengaja dari DESIGN v0

Dokumen turunan mengoreksi dua hal di DESIGN.md; DESIGN.md sendiri dibiarkan sebagai catatan historis v0:

- **Closure sebagai string di spec** (DESIGN §Schema aturan 1): tidak dilakukan. `$computed` hanya memanggil fungsi terdaftar; alasan di [ADR-0002](./adr/0002-client-first-reactivity.md).
- **Validasi client json-render** tidak dipakai sama sekali; hanya VineJS ([ADR-0003](./adr/0003-server-only-validation.md)).
- **Data tabel di `page.data`** (WIRE_PROTOCOL v0): dipindah ke prop top-level `data` karena `@adonisjs/inertia` 5 hanya menyaring partial reload pada prop top-level ([ADR-0011](./adr/0011-table-data-top-level-prop.md)).
- **Submit action via `router.post` + `{ patch }`**: diganti transport `fetch` JSON dengan `ActionResult` ([ADR-0012](./adr/0012-action-json-transport.md)).
- **Middleware panel sebagai string** (`.middleware(['auth'])`): panel menerima referensi middleware asli dari `#start/kernel`, karena package tidak bisa mengimpor koleksi named middleware host.
- **Tabs/Wizard via named slots**: memakai anak `Tab` biasa (SPIKE Q4).

## Keputusan yang dikonfirmasi (2026-10-10)

Ditanyakan setelah draf pertama dan dijawab; dokumen sudah mencerminkannya:

- M1 **termasuk** repeater, fileUpload (tanpa image editor), richEditor, infolist/view page karena project dogfood pertama membutuhkannya (WP13–WP16). SPIKE K1 menjadi prasyarat keras M1.
- API tambahan di luar DESIGN v0 (`panel.domain()`, `.userMenu()`, `action.rateLimit()`, `t.count()`, `pages.list().modals()`, `.deferFilters()`) masuk scope dengan target M2–M3.
- Export async memakai tabel `pupitre_exports` (dibuat hanya bila adapter `jobs` dipasang).
- Tiga package inti dirilis lockstep.
- Test client: Japa + happy-dom untuk `pupitre-react`; Playwright component test untuk `pupitre-ui`.
- `sort` kolom non-sortable → 400; filter tak dikenal diabaikan.
- Barrel `.adonisjs/server/admin.ts` di-gitignore.
- Social login menambah kolom `users.provider`/`provider_id` opsional dengan fallback cocok-email.

## Keputusan implementasi M1 (2026-10-10)

- Resource tanpa `.pages()` mendapat list/create/edit; view ditambahkan otomatis kalau ada `.infolist()`. `.pages({...})` eksplisit menggantikan default, sehingga page yang tidak disebut nonaktif (route-nya tidak didaftarkan).
- Item repeater membawa `_key` di state (dibuang VineJS); operasi per item selain tambah dikerjakan komponen UI (lihat CATALOG §3).
- `afterStateUpdated` yang tidak bisa diangkat ke `setState` + ekspresi ditolak saat compile (`E_PUPITRE_UNLIFTABLE_CLOSURE`) sampai evaluasi server tersedia di M3.
- `refresh.table()` menghasilkan `ActionResult.reload` (bukan patch).
- Hook resource dan handler kustom menerima transaksi Lucid sebagai argumen terakhir setelah `ctx` (`create(data, ctx, trx)`, `update(record, data, ctx, trx)`, `beforeSave(record, data, ctx, trx)`, …), sehingga tulisan handler ikut di-rollback bila hook setelahnya gagal.
- Submit action mengirim `X-Pupitre-Url` (URL halaman) sebagai dasar `redirect.back()`; method HTTP mengikuti `ActionDescriptor.method` (delete record = `DELETE`). Flash JSON hanya lewat `ActionResult`, tidak juga ke session.
- Field `disabled` tidak di-dehydrate kecuali `.dehydrated(true)`; field opsional yang dikosongkan disimpan sebagai `null`; `time` disimpan sebagai jam dinding `HH:mm[:ss]`; `date` tidak digeser timezone.
- Kunci `fileUpload` yang dikirim harus sama dengan nilai tersimpan atau berasal dari unggahan sesi yang sama (resource + field).
- Resource dengan policy tetapi tanpa Bouncer terinisialisasi gagal tertutup (`E_PUPITRE_BOUNCER_NOT_INITIALIZED`); `.guard(name)` panel memaksa autentikasi dengan guard itu.
- Cache spec hanya menyimpan bagian yang tidak bergantung record/user/timezone; nilai record, URL form, prop timezone, dan closure statis diterapkan per request.
- Versi yang dipakai: `@adonisjs/inertia` 5 (Inertia v3), `@base-ui/react` 1.9, `@tanstack/react-table` 8.21 (lihat tabel dependensi di IMPLEMENTATION_PLAN).
