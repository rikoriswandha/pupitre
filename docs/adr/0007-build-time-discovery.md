# ADR-0007: Discovery resource saat build (hook adonisrc), bukan scan runtime

- Status: Accepted
- Tanggal: 2026-10-10

## Keputusan
Hook `indexAdmin()` di `adonisrc.ts` (pola `indexPolicies` v7) memindai `app/admin/{resources,pages,widgets,relation_managers,panels}` saat dev/build dan menulis barrel bertipe `.adonisjs/server/admin.ts`. Panel menerima array dari barrel.

## Alternatif yang ditolak
- `discoverResources(path)` runtime seperti Filament — glob + dynamic import saat boot, tidak type-safe, slug salah ketik baru ketahuan di runtime.
- Registrasi manual tanpa hook — DX menurun untuk project besar.

## Konsekuensi
- `nav.items(['posts'])` type-checked terhadap key barrel.
- Barrel adalah file generated: di-gitignore, dibuat ulang oleh `node ace serve`/`build`; CI memastikan barrel tidak dicommit.
