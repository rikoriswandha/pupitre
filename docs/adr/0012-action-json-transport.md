# ADR-0012: Submit action lewat `fetch` JSON, bukan `router.post` Inertia

- Status: Accepted
- Tanggal: 2026-10-10

## Konteks

Satu submit action perlu bisa menghasilkan beberapa hal: flash, redirect, reload sebagian (`only: ['data']`), patch, kosongkan seleksi, atau 422/403 tanpa menutup modal. Respons untuk request Inertia harus berupa page object atau redirect, sehingga JSON `{ patch }` (WIRE_PROTOCOL awal) tidak bisa dikembalikan ke `router.post`. Event json-render juga tidak membawa payload runtime, jadi komponen yang menjalankan action (DataTable, ActionBar) memanggil hook `useRunAction()` langsung.

## Keputusan

Semua submit action (`direct`, `confirm`, `form`, bulk, `actions.delete()`) memakai `fetch` same-origin dengan header `X-Pupitre-Action: 1` dan token `X-XSRF-TOKEN` dari cookie Shield. Server menjawab JSON: `200 ActionResult { flash, redirect?, reload?, patch?, deselect? }`, `422 { errors }`, `403/404 { message }`. Route resource (`store`/`update`/`destroy`) memakai negosiasi yang sama: redirect Inertia untuk form halaman, JSON untuk request ber-header `X-Pupitre-Action`. Form halaman create/edit tetap submit lewat Inertia router.

## Alternatif yang ditolak

- `router.post` untuk semua action — tidak bisa membawa patch/reload sebagian, dan 403 menjadi redirect yang menutup modal.
- Endpoint terpisah untuk JSON — dua jalur untuk logika yang sama.

## Konsekuensi

- CSRF: Shield harus memasang cookie `XSRF-TOKEN` (`enableXsrfCookie: true`, default starter kit).
- `refresh.table()` saat ini menghasilkan `reload: true` (bukan patch) karena executor action tidak memegang query tabel aktif.
- Test `pupitre-react` memalsukan `fetch` lewat seam `setFetch()`; test server memastikan 403 tetap terjadi walau client mengirim action yang `enabled: true`.
