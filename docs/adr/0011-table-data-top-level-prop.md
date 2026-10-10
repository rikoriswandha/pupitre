# ADR-0011: Data tabel sebagai prop Inertia top-level `data`

- Status: Accepted
- Tanggal: 2026-10-10

## Konteks

WIRE_PROTOCOL awal menaruh `TableData` di `page.data` dan me-refresh tabel dengan `router.reload({ only: ['page.data'] })`. `@adonisjs/inertia` 5 (pasangan Inertia v3) menyaring partial reload hanya pada nama prop top-level: `inertia_manager` memilih `Object.keys(finalProps)` yang tercantum di header `X-Inertia-Partial-Data`. `only: ['page.data']` karenanya tidak mengembalikan apa pun dari `page`.

## Keputusan

`TableData` dikirim sebagai prop top-level `data` (saudara `page` dan `pupitre`). List page dan `useTable` memakai `router.reload({ only: ['data'], data: query })`; `ActionResult.patch` diterapkan ke prop `data`. `PupitrePageProps = { pupitre, page, data? }`.

## Alternatif yang ditolak

- Tetap di `page.data` dengan reload penuh — spec + descriptor dikirim ulang setiap sort/filter, melawan ADR-0004.
- Memecah `page` menjadi beberapa prop top-level (`spec`, `state`, ...) — memperbesar kontrak tanpa manfaat; hanya data tabel yang perlu partial reload di M1.

## Konsekuensi

- Test integrasi memastikan `only: ['data']` mengembalikan `data` saja.
- Widget/relation manager (M3) yang butuh partial reload juga harus memakai prop top-level bernama sendiri.
