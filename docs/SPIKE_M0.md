# Pupitre — Spike M0

Tujuan: membuktikan `@json-render/core` + `@json-render/react` 0.21.x cukup sebagai wire format dan renderer Pupitre **tanpa fork**. Durasi 1–2 hari. Hasil: keputusan GO (lanjut M1 di atas json-render) atau FALLBACK (spec sendiri, lihat §6).

Fakta yang sudah diverifikasi dari dokumentasi json-render 0.21 (Sept 2026) sebelum spike, jadi spike tinggal mengonfirmasi perilaku runtime:

- Ada `repeat: { statePath, key }` pada elemen dan `$bindItem`/`$item`/`$index` untuk anak-anaknya; nested repeat memakai `repeat.statePath: { $item: 'field' }`.
- Built-in actions `setState`, `pushState`, `removeState`, `validateForm` ditangani `ActionProvider`.
- `watch` adalah field top-level elemen; hanya fire saat nilai berubah, bukan render awal; beberapa action per path berjalan berurutan.
- `StateProvider` menerima `store` (controlled mode); `@json-render/core/store-utils` menyediakan `createStoreAdapter`; ada `@json-render/zustand`.
- `defineRegistry(catalog, { components, actions })`; `actions` opsional kalau catalog tanpa actions.
- `$computed` memanggil fungsi **terdaftar** via prop `functions`, tidak ada eval string.

## 1. Setup

```bash
npm init adonisjs@latest pupitre-spike -- --kit=inertia --adapter=react --no-ssr --auth-guard=session
cd pupitre-spike
npm i @json-render/core@0.21.0 @json-render/react@0.21.0 @json-render/zustand zustand zod
npx shadcn@latest init        # pilih base: Base UI
npx shadcn@latest add input select checkbox button card tabs
```

Struktur spike (semua di host app, belum ada package):

```
spike/
  catalog.ts        # defineCatalog: Form, Section, Text, Number, Select, Checkbox, Repeater, Placeholder
  registry.tsx      # defineRegistry → komponen shadcn Base UI
  store.ts          # Zustand + createStoreAdapter
  bridge.ts         # actions: submitForm, reload, evaluate
  specs/            # spec statis hasil "compiler manual"
app/controllers/spike_controller.ts   # GET /spike → inertia.render('spike', { spec, state })
                                      # PUT /spike → VineJS → 422 atau redirect
                                      # POST /_pupitre/evaluate → { set }
inertia/pages/spike.tsx
```

Pin versi exact. Catat commit json-render yang dipakai di `docs/SPIKE_M0.md` §7.

## 2. Lima kriteria lulus

Setiap kriteria punya langkah, observasi yang diharapkan, dan bukti (screenshot/console/test).

### K1 — Repeater tanpa fork

**Hipotesis:** `Repeater` bisa dibuat sebagai komponen domain yang merender children template dengan `repeat.statePath: '/data/items'` dan field di dalamnya memakai `$bindItem`.

Spec uji:

```json
{
  "root": "form",
  "state": { "data": { "items": [{ "sku": "A", "qty": 1, "price": 10 }] } },
  "elements": {
    "form": { "type": "Form", "props": { "method": "put", "url": "/spike" }, "children": ["rep"] },
    "rep": {
      "type": "Repeater",
      "props": { "descriptor": { "name": "items", "minItems": 1, "reorderable": true } },
      "repeat": { "statePath": "/data/items", "key": "sku" },
      "children": ["sku", "qty", "price", "subtotal"]
    },
    "sku":   { "type": "Text",   "props": { "name": "sku",   "value": { "$bindItem": "sku" } } },
    "qty":   { "type": "Number", "props": { "name": "qty",   "value": { "$bindItem": "qty" } } },
    "price": { "type": "Number", "props": { "name": "price", "value": { "$bindItem": "price" } } },
    "subtotal": { "type": "Placeholder", "props": { "content": { "$computed": "mul", "args": { "a": { "$item": "qty" }, "b": { "$item": "price" } } } } }
  }
}
```

Langkah & ekspektasi:

1. Render → 1 item, subtotal 10. Ubah qty ke 3 → subtotal 30 **tanpa** re-mount Form (pasang `useEffect(() => console.log('mount'))` di Form).
2. Tombol "Add" di Repeater → `emit('pushState', { path: '/data/items', value: { sku: '', qty: 1, price: 0 } })` → item kedua muncul; item pertama tidak kehilangan fokus/nilai.
3. "Remove" item 1 → `removeState` → item kedua tetap benar (key stabil).
4. Reorder (swap) via `setState('/data/items', reordered)` → tidak ada remount per item (cek `key`).
5. **Repeater bersarang** (`items[].variants[]`) dengan `repeat.statePath: { $item: 'variants' }` → bind dan push bekerja di level dalam.
6. Error path: `set('/errors/items/0/sku', 'Required')` → field pertama menampilkan error; field kedua tidak. Perlu memastikan `$bindItem`/`$item` bisa membaca **error** per item: kalau `error: { $state: '/errors/items/<index>/sku' }` tidak bisa diekspresikan, Repeater domain harus menyediakan context `itemIndex` dan field membaca `/errors/${prefix}/${index}/${name}` sendiri. Catat mana yang berhasil.

Bukti: rekaman console `mount` hanya satu kali; screenshot item ganda; test Playwright kecil.

**Gagal kalau:** push/remove mere-mount seluruh Repeater, atau nested repeat tidak mendukung `$bindItem`, atau tidak ada cara memetakan error per item.

### K2 — State form bertahan saat `router.reload({ only })` dan 422

1. Isi field `title` = "draft x". Klik tombol yang memanggil `router.reload({ only: ['page.meta'] })`. Ekspektasi: `title` tetap "draft x" (store hidup di luar page component; props baru tidak memicu `initialState` ulang).
2. Submit form dengan data invalid → server 422 Inertia errors `{ 'items.0.sku': 'Required' }` → bridge memetakan ke `/errors/items/0/sku`; `/data` tidak berubah; ketikan user utuh.
3. Navigasi ke `/spike?record=2` (page.key berubah) → store direset dari `state` baru.
4. Submit valid → redirect → `/errors` kosong, `/meta/record` diperbarui.

Implementasi uji: `store.ts` membuat Zustand store **di dalam** `PupitreProvider` (bukan module singleton) dan dipegang di `useRef`; reset hanya saat `page.key` berubah.

**Gagal kalau:** satu-satunya cara mencegah reset adalah mem-bypass `StateProvider` (misal patch internal), atau props update selalu meresync state.

### K3 — `watch` memicu handler custom tanpa re-mount

1. `Select status` dengan `watch: { '/data/status': [{ action: 'evaluate', params: { field: 'status' } }] }`.
2. Action `evaluate` di `ActionProvider` memanggil `router.post('/_pupitre/evaluate', { field, state })` dengan `preserveState: true` dan membaca respons `{ set: { '/data/slug': 'x' } }` lalu `store.set`. Catatan: Inertia `router.post` mengharapkan respons Inertia; untuk JSON gunakan `fetch` dengan header CSRF, atau `router.post` ke route yang mengembalikan `inertia.render` dengan prop `evaluate` dan bridge membaca prop itu. **Uji keduanya**, pilih yang paling sederhana untuk M1 (dugaan: `fetch` JSON + token Shield dari meta tag).
3. Ekspektasi: mengganti status → request → `/data/slug` terisi; tidak ada log `mount` baru; `watch` **tidak** fire pada render awal.
4. Dua watcher pada satu path berjalan berurutan (uji dengan dua action yang menulis ke `/log`).

**Gagal kalau:** watch fire pada mount (akan memicu request liar), atau action async tidak bisa menulis balik ke store.

### K4 — Registry menerima komponen shadcn Base UI host

1. `defineRegistry(catalog, { components: { Text: ShadcnInput, Select: ShadcnSelect, ... } })` di mana komponen adalah hasil `shadcn add` dengan base **Base UI**, dibungkus adaptor kecil yang membaca `useBoundProp(props.value)`.
2. Tidak ada `@json-render/shadcn` di dependency tree (`npm ls @json-render/shadcn` kosong), tidak ada `@radix-ui/*` (`npm ls | grep radix` kosong).
3. Mengganti satu komponen (`Select`) dengan implementasi lain tanpa menyentuh yang lain; TypeScript menolak komponen yang props-nya tidak cocok dengan Zod catalog (uji dengan sengaja memberi prop salah).

**Gagal kalau:** `defineRegistry` memaksa bentuk komponen yang tidak kompatibel dengan props Base UI (misal event signature), atau type inference catalog → komponen tidak jalan.

### K5 — SSR-safe

1. `grep -rn "window\.\|document\." node_modules/@json-render/react/dist/` → hanya di dalam fungsi/efek, tidak di module scope. Catat hasilnya.
2. `node -e "import('@json-render/react').then(() => console.log('ok'))"` berjalan di Node tanpa jsdom.
3. Render `renderToString(<Spike spec state />)` di script Node → tidak throw.

**Gagal kalau:** import saja sudah menyentuh `window`.

## 3. Pengukuran tambahan (tidak menggugurkan, tapi dicatat)

- Ukuran bundle `@json-render/react` + `core` setelah tree-shake (`vite build --mode analyze`).
- Waktu render spec 200 elemen (profil React).
- Perilaku `validateSpec`/`autoFixSpec` pada spec yang dihasilkan compiler manual: apakah kita bisa memakainya sebagai assertion di test compiler.
- Apakah `Renderer` menerima `functions` untuk `$computed` tanpa `JSONUIProvider` (menentukan apakah kita memakai `createRenderer` atau provider).

## 4. Pertanyaan yang harus terjawab di akhir spike

| # | Pertanyaan | Dampak pada M1 |
| --- | --- | --- |
| Q1 | Error per item repeater: via ekspresi atau via context Repeater? | Bentuk `error` prop di catalog |
| Q2 | `evaluate` lewat `fetch` JSON atau route Inertia? | Desain `bridge.evaluate`, CSRF |
| Q3 | Reset store: `page.key` saja cukup, atau perlu membedakan "record sama tapi redirect setelah save"? | Semantik `page.key` |
| Q4 | Named slots json-render cukup untuk Tabs/Wizard? | Catalog Tabs/Wizard |
| Q5 | `@json-render/zustand` dipakai langsung atau `createStoreAdapter` sendiri? | Dependency `pupitre-react` |
| Q6 | Apakah `repeat` mendukung `visible` per item + `$index` untuk "collapsed" state di `/ui`? | Repeater collapsible |

## 5. Keputusan GO

GO kalau K1–K5 lulus dengan paling banyak satu *workaround* lokal yang tidak menyentuh internal json-render (adaptor di komponen Pupitre sendiri boleh). Hasil ditulis di §7 dan DESIGN.md baris "Wire format" diperbarui menjadi "dikunci". Catatan: repeater masuk scope M1 (keputusan 2026-10-10), jadi K1 bukan sekadar kriteria spike tetapi prasyarat WP13; kalau K1 gagal, fallback §6 harus dikerjakan **sebelum** WP13, bukan ditunda.

## 6. Fallback kalau gagal

Tetap memakai **bentuk spec yang sama** (flat `root`+`elements`, ekspresi `$state`/`$cond`/`$template`) tetapi renderer ditulis sendiri di `pupitre-react` (~600–900 baris: resolver ekspresi, visibility, repeat, watch, store). Keuntungan: compiler tidak berubah, hanya `renderer/` yang berubah; `@json-render/core` bisa tetap dipakai untuk `resolvePropValue`, `validateSpec`, `applySpecStreamPatch` karena itu utilitas murni. Keputusan ini diambil hanya kalau K1 atau K2 gagal; K3–K5 gagal cukup diatasi adaptor.

## 7. Hasil

> Diisi saat spike selesai.

| Kriteria | Hasil | Bukti | Catatan |
| --- | --- | --- | --- |
| K1 | | | |
| K2 | | | |
| K3 | | | |
| K4 | | | |
| K5 | | | |

Versi: `@json-render/core@`, `@json-render/react@`, `@adonisjs/core@`, `@adonisjs/inertia@`, `@inertiajs/react@`, `shadcn@`, commit json-render: ``.

Keputusan: **GO / FALLBACK**. Jawaban Q1–Q6: …
