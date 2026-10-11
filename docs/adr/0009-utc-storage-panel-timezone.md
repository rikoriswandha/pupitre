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
- `DateTime` menampilkan nilai ISO ber-offset sebagai wall-clock zona efektif. Submit `datetime-local` dikirim tanpa offset dan diparse server dalam zona efektif; ISO dengan offset mempertahankan instant eksplisitnya. Gap DST ditolak, overlap memakai offset awal (lebih besar). `Date` selalu kalender dan tidak digeser.
- `Time` tanpa tanggal tidak dapat menentukan offset DST; nilai yang disimpan tetap `HH:mm[:ss]` sebagai jam dinding, tanpa konversi UTC.

## Addendum (WP35)

Nilai lokal yang tidak ada selama transisi maju (misalnya `2026-03-29 02:30` di `Europe/Amsterdam`) gagal validasi. Nilai yang muncul dua kali selama transisi mundur (misalnya `2026-10-25 02:30`) memilih occurrence pertama/offset lebih awal. Prioritas timezone komponen > user > panel > app berlaku pada form, tabel, filter tanggal, dan infolist. Komponen native menampilkan hint ketika timezone efektif berbeda dari zona browser; browser tidak mengurai instant dengan zona lokal.
