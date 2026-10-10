# ADR-0010: Cache compiled schema per panel:resource:page:locale:hash, bukan per tenant

- Status: Accepted
- Tanggal: 2026-10-10

## Konteks
Compile schema per request mahal (closure lifting, Zod validate). Tetapi beberapa bagian spec bergantung record, ctx, atau tenant.

## Keputusan
Cache key `${panel}:${resource}:${page}:${locale}:${hash(definition.toJSON())}`. Yang bergantung record/ctx/tenant tidak masuk cache: closure yang jatuh ke `static`, `fillForm`, `visible`/`can` per action. Mereka disimpan sebagai daftar slot dan dievaluasi per request, hasilnya di-patch (RFC 6902) ke salinan spec cache. Cache dimatikan di development secara default.

## Alternatif yang ditolak
- Key per tenant — cardinality × jumlah tenant, dan tetap perlu patch per record.
- Tanpa cache — latensi list/edit untuk resource besar.

## Konsekuensi
- `definition.toJSON()` harus deterministik (builder immutable, closure di-hash dari `toString()`); test snapshot menjaga ini.
- Objek cache tidak boleh dimutasi; compiler selalu `structuredClone` sebelum patch.
