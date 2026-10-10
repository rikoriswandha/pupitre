# ADR-0006: Komponen di atas shadcn/ui dengan Base UI, bukan Radix

- Status: Accepted
- Tanggal: 2026-10-10

## Konteks
shadcn menjadikan Base UI default sejak Juli 2026. `@json-render/shadcn` resmi berbasis Radix.

## Keputusan
`pupitre-ui` dibangun di atas shadcn + `@base-ui-components/react`; registry mem-pin `registry:base` ke `base`. Tidak ada varian Radix. `@json-render/shadcn` tidak dipakai; registry json-render diisi komponen Pupitre sendiri (SPIKE K4).

## Alternatif yang ditolak
- Radix — arah shadcn sudah pindah; dua varian menggandakan pemeliharaan.
- `@json-render/shadcn` — Radix, dan kontrak props-nya bukan kontrak Pupitre.

## Konsekuensi
- Host dengan shadcn Radix lama memakai paket npm `pupitre-ui` apa adanya (komponen Base UI berdiri sendiri, tidak bentrok).
- Komponen UI dibungkus adaptor tipis agar perubahan API Base UI 1.x terlokalisasi.
