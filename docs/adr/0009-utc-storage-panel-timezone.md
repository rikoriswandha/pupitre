# ADR-0009: Simpan UTC, tampilkan di timezone panel/user/komponen

- Status: Accepted
- Tanggal: 2026-10-10

## Keputusan
Semua `dateTime` disimpan UTC (Luxon `DateTime`, kolom `timestamptz`). Timezone tampilan dan parsing input: komponen `.timezone()` > kolom `users.timezone` (kalau ada) > `.timezone()` panel > `config/app.ts`. Nilai dikirim ke client sebagai ISO 8601 dengan offset; cell tabel dikirim sudah terformat oleh server.

## Alternatif yang ditolak
- Simpan waktu lokal — ambigu saat DST dan multi-tenant lintas zona.
- Format di client dengan `Intl` — hasil berbeda antar browser/OS, sulit di-test, dan server-side formatted field sudah menjadi konvensi di project penulis.

## Konsekuensi
- Test DST wajib (TESTING §8).
- Komponen `Date*` menerima ISO + `timezone` prop dan mengirim balik ISO UTC; tidak pernah mengirim string lokal tanpa offset.
