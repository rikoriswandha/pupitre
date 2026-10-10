# ADR-0003: Validasi hanya di server (VineJS)

- Status: Accepted
- Tanggal: 2026-10-10

## Konteks
json-render punya validasi client (`check.*`, `validateForm`). Menduplikasi rule di client dan server menghasilkan dua sumber kebenaran dan pesan yang berbeda.

## Keputusan
Rule builder dikompilasi ke satu `vine.compile()` per form. Client hanya menampilkan `required` sebagai tanda bintang dan `maxLength` sebagai counter; semua penolakan datang dari 422 Inertia yang dipetakan ke `/errors/**`. `validateForm` json-render tidak dipakai.

## Alternatif yang ditolak
- Validasi ganda — drift pesan, rule `unique`/`exists` tetap harus di server.
- Validasi client saja — tidak aman.

## Konsekuensi
- Feedback error muncul setelah submit, bukan saat mengetik; untuk field `live()` dengan `server: true` host bisa menambahkan validasi dini lewat `evaluate` kalau mau.
- Path error VineJS (`items.0.sku`) adalah kontrak pemetaan; diuji di TESTING §2.
