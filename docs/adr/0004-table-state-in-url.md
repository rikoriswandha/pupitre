# ADR-0004: State tabel di URL query

- Status: Accepted
- Tanggal: 2026-10-10

## Keputusan
Sort, search, filter, page, perPage, tab, groupBy, dan prefix relation manager hidup di query string (WIRE_PROTOCOL §5.1). Server membangun query Lucid hanya dari URL; `router.reload({ only: ['page.data'] })` cukup untuk refresh. Column toggles dan layout (preferensi tampilan, bukan data) di `localStorage`.

## Alternatif yang ditolak
- Session (`persistFiltersInSession` Filament) — tidak shareable, back-button tidak bekerja, sulit di-test.
- State client saja — hilang saat reload.

## Konsekuensi
- URL bisa panjang; filter form kompleks diserialisasi `filters[name][key]=v`. Batas panjang URL praktis ~8 KB; `pupitre:inspect` memperingatkan filter dengan banyak field.
- Param tak dikenal diabaikan, sort kolom non-sortable → 400 (bukan diam-diam diabaikan) supaya bug terlihat.
