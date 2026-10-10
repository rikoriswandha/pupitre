# ADR-0001: json-render sebagai wire format dan renderer

- Status: Proposed (menjadi Accepted setelah SPIKE_M0 GO)
- Tanggal: 2026-10-10

## Konteks
Pupitre butuh format deklaratif server → client untuk form, infolist, dan layout yang mendukung binding state, visibilitas kondisional, iterasi (repeater), dan watcher. Menulis format + renderer sendiri berarti memelihara resolver ekspresi, store, dan reconciliation.

## Keputusan
Memakai `@json-render/core` + `@json-render/react` 0.21.x apa adanya: spec flat `root`+`elements`, ekspresi `$state/$bindState/$bindItem/$cond/$template/$computed`, `visible`, `repeat`, `watch`, `StateStore` controlled mode. Pupitre menambah komponen domain dan action di catalog, tidak menambah sintaks.

## Alternatif yang ditolak
- Spec sendiri — lebih banyak kode untuk hal yang sudah ada; kehilangan `validateSpec`, store adapters, dan renderer lain (Vue/Svelte) di masa depan.
- Komponen React per page (seperti Filament Livewire → Blade) — bundle host berisi semua komponen, tidak bisa copy via registry.

## Konsekuensi
- Risiko 0.x: versi dipin exact; hanya `src/compiler` dan `pupitre-react/renderer` yang menyentuh format; fallback didefinisikan di SPIKE_M0 §6 (renderer sendiri, format tetap).
- `@json-render/core` di server hanya untuk tipe dan utilitas murni (`validateSpec`, `applySpecStreamPatch`).
- Test spike dijadikan regression suite saat upgrade json-render.
