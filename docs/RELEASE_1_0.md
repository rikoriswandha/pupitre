# Audit Rilis 1.0

Catatan audit WP42 milestone M4. Setiap bagian mencatat pemeriksaan, perbaikan, bukti regresi, dan risiko residual.

## Aksesibilitas

Audit komponen registry `packages/pupitre-ui/src/components.ts` memakai axe WCAG 2.1 A/AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) tanpa pengecualian aturan. CT memakai HTML berbahasa Inggris dengan judul dokumen dan Tailwind Vite plugin supaya CSS, kontras, ukuran target, serta fokus diuji pada hasil render sesungguhnya.

| Komponen | Cakupan | Perbaikan / residual |
| --- | --- | --- |
| Text, Textarea, Number, Slider, Hidden, Checkbox, CheckboxList, Date, DateTime, Time, Color, Tags, KeyValue | Render catalog axe; nama, required, invalid, deskripsi error dan keyboard CheckboxList | Text tanpa label memakai nama field; ikon hint memakai semantik gambar hanya bila punya tooltip. CheckboxList memisahkan scope `Field.Item` per opsi sehingga nama tidak diwariskan dari opsi pertama. Checkbox/CheckboxList memakai ring fokus dan target 24px. |
| Infolist, TextEntry, IconEntry, ImageEntry, ColorEntry, KeyValueEntry, RepeatableEntry, CodeEntry, BadgeEntry | Render catalog axe | Tiap EntryShell menjadi pasangan `dt`/`dd` dalam `dl` mandiri; Infolist memakai grid netral agar layout bersarang tetap valid. Swatch warna dekoratif disembunyikan dari pembaca layar karena nilai tekstual sudah tersedia. |
| Form, Grid, Section, Fieldset, Group, Split, Placeholder, Html, Divider, Actions, View, Fragment, ActionBar, RelationManager | Render catalog axe | Layout diperiksa bersama fixture catalog. |
| Select, Radio, Toggle, ToggleButtons, Tabs, Tab, FileUpload, MarkdownEditor, CodeEditor, RichEditor | Render catalog dan keadaan interaktif | Audit popup, toolbar serta navigasi keyboard melengkapi render awal. |
| Builder, BuilderItem, Repeater, RepeaterItem, Wizard, Step, DataTable | Render catalog dan keadaan interaktif | Cakupan item, langkah, selection/filter/kolom serta tindakan tabel. |
| Widget.Stats, Widget.Chart, Widget.Table, Widget.Timeline, WidgetGrid | Render catalog dan widget interaktif | Ringkasan, chart, tabel serta timeline aktivitas diperiksa. |
| Shell, AuthShell, Toaster, Modal, ConfirmDialog, NotFound, ImportModal; ShellSidebar, NotificationTray, GlobalSearch, TenantSwitcher, UserMenu, ProfileSecurity | Render dan keadaan terbuka | Landmark, menu, modal, fokus/Escape, notifikasi dan keamanan profil diperiksa melalui CT khusus. |

Perbaikan interaksi: Radio memakai scope label per opsi dan target/ring 24px seperti CheckboxList; ToggleButtons memakai Base UI ToggleGroup untuk satu tab stop dan arrow-key navigation yang melewati opsi disabled. Tabs memiliki ID unik per instance dan Arrow/Home/End; Wizard memisahkan angka dan label langkah dalam nama aksesibel. DataTable mengekspos `aria-sort` dan selection campuran. FileUpload/editor menghubungkan label/help/error; loading editor memakai `role=status`. Chart menyediakan tabel data dan sparkline menyediakan urutan angka. Shell menyediakan skip link, banner/main/navigation, dialog navigasi mobile, dan fokus kembali; GlobalSearch menyembunyikan listbox kosong dan mengumumkan loading/hasil kosong melalui status.

Pengecualian terjustifikasi: CT menu nonmodal mengecualikan hanya `[data-base-ui-focus-guard]`, sentinel tersembunyi milik Base UI yang segera mengalihkan fokus saat Tab. Axe menandai sentinel sebagai `aria-hidden-focus`, tetapi sentinel bukan kontrol aplikasi. Tidak ada aturan axe dinonaktifkan dan tidak ada konten aplikasi dikecualikan; assertion fokus/Escape tetap diuji.

E2E `apps/example/e2e/51_a11y.spec.ts` memeriksa login, dashboard, posts list/create/edit/view dengan timeline, roles create, activity list/view, settings dan profile security. Suite menolak serious/critical WCAG A/AA tanpa allow-list; data post milik tes dibersihkan di `finally`. E2E ini ditulis tanpa dijalankan oleh agent audit, sesuai pembagian verifikasi orchestrator.

Bukti verifikasi: **138 CT lulus** pada gabungan `catalog.spec.tsx`, `interactions.spec.tsx`, `checkbox_list_a11y.spec.tsx`, `shell_a11y.spec.tsx`, dan `interaction_a11y.spec.tsx`. Sebanyak **65 nama registry** tercakup oleh render catalog atau CT shell/widget khusus. Typecheck UI (termasuk tsconfig CT), ESLint dan Prettier untuk source/spec yang diubah lulus; registry dibangun ulang **87 item**, `registry:check` beserta **3 tes** integritas lulus.

Temuan kontras serius pada tombol Remove Repeater saat hover diperbaiki dengan sedikit menurunkan lightness token destructive tema terang agar kontras tetap AA di latar muted. Pengukuran axe menunggu transisi warna selesai, bukan mengambil midpoint animasi. Sel DataTable bertipe toggle/icon memakai role gambar bernama agar label ARIA valid.

Risiko residual: axe tidak menggantikan uji manual pembaca layar, zoom/reflow, high contrast, atau kualitas navigasi bagi pengguna dengan disabilitas. Tema/konten/custom view milik aplikasi dapat menambah pelanggaran di luar fixture bawaan; host harus menjalankan E2E pada konfigurasi produksinya.


## Keamanan

### CSRF dan CSP

- `config/shield.ts` example mengaktifkan CSRF untuk POST/PUT/PATCH/DELETE tanpa `exceptRoutes`, CSP enforced dengan `script-src 'self'` + nonce, tanpa `unsafe-eval`, dan `X-Content-Type-Options: nosniff`.
- Tes functional `tests/functional/security.spec.ts` membaca seluruh `router.toJSON()` setelah aplikasi boot. **152 pasangan method/rute mutasi** diuji dua kali (token tidak ada dan token tidak valid): semuanya 403 dengan penanda CSRF. Cakupan mencakup signup/login/logout host, auth/profile/MFA/passkey, resource CRUD, actions, imports/exports, relation managers, evaluasi/options/upload/notifikasi, roles, panel app, serta POST `__transmit/subscribe` dan `__transmit/unsubscribe`. Allow-list mutasi: **kosong**. SSE Transmit memakai GET sehingga bukan pengecualian mutasi.
- Perbaikan medium: handler default Shield mengembalikan redirect 302 untuk penolakan CSRF; example sekarang mengembalikan 403 eksplisit, bukan respons berbentuk sukses. Hasil functional terakhir: **2 tes lulus** pada SQLite terisolasi `tmp/security-test.sqlite`.
- Perbaikan medium: `jsonFetch(Request)` sebelumnya menganggap method GET bila `init.method` tidak diisi, sehingga tidak menambahkan XSRF. Method/header Request kini dipertahankan. Regresi mencakup seluruh method mutasi, multipart, upload/delete, dan token eksplisit. Header subscribe/unsubscribe Transmit sudah memiliki regresi.
- Pencarian source pupitre-react/pupitre-ui dan runtime json-render tidak menemukan jalur `eval`/`new Function` yang dipakai Pupitre. Zod v4 memiliki probe Function yang tetap memicu pelanggaran CSP walau exception ditangkap. Entry catalog browser kini mengatur `z.config({ jitless: true })` **sebelum konstruksi schema**, dengan side-effect metadata agar bundler tidak membuangnya. Server tetap memakai konfigurasi JIT semula.
- Regresi subprocess memasang Function trap sebelum import catalog; E2E `50_csp.spec.ts` merekam `securitypolicyviolation` pada login/dashboard/list/create/edit/view/roles/activity/settings serta chunk rich/code editor, dan menolak header `unsafe-eval`. E2E ditulis blind; eksekusi menjadi gerbang orchestrator.
- Penolakan CSRF untuk Inertia kini memakai page `errors/csrf_expired` dengan status 403, bukan modal raw JSON; tes functional menguji header `X-Inertia` dan component tersebut. Regresi subprocess mengimpor entry runtime pupitre-react terlebih dahulu untuk menguji urutan inisialisasi dependency, bukan hanya catalog.

### Otorisasi plugin dan perkakas

- High, diperbaiki: editor role non-super-admin tidak boleh membuat/mengganti nama role super-admin, mengubah/menghapus role super-admin, atau memberikan permission yang tidak dimilikinya. Delegasi permission yang dimiliki tetap diizinkan.
- Medium, diperbaiki: cache grant Shield dibatalkan saat role disimpan/dihapus dan permission plugin disinkronkan. Host yang mengubah pivot role-user atau permission-role secara langsung wajib memanggil `invalidateShieldPermissions()` setelah mutasi.
- Medium, diperbaiki pada review adversarial: `shieldRolesField()` kini benar-benar memuat/menyimpan pivot role secara transaksional, bukan membuang assignment melalui Lucid merge. Assignment/revocation memerlukan `roles.update` bagi non-super-admin; perubahan role super-admin atau role dengan grant yang tidak dimiliki aktor ditolak.
- Medium, diperbaiki pada review adversarial: konteks worker mengikat `HttpContext` ke resolver dan Bouncer memakai resolver tersebut. Regresi menjalankan handler produksi queued bulk dengan sesi/grants asli, lalu menguji pengguna lain, pencabutan permission, record lintas tenant, dan membership dicabut.
- High, diperbaiki pada review konfirmasi: pemeriksaan grant dalam handler assignment/role edit menggunakan transaction client aktif, bukan pool default; cold-cache revocation pada SQLite single-connection tidak lagi deadlock. Snapshot transaksi tidak mengonsumsi/mengisi cache request, dan rollback tidak meninggalkan grant palsu.
- Delegasi permission role berlaku simetris untuk penambahan maupun penghapusan: aktor harus memiliki grant yang berubah. Rename dengan grant kuat yang tidak berubah tetap diizinkan; permission eksternal yang tidak dikelola form dipertahankan.
- Activity membatasi daftar/detail pada tenant aktif; tautan subject hanya tersedia untuk record yang lolos scope serta otorisasi daftar dan record. Channel Transmit memverifikasi principal guard panel, identitas pengguna, keanggotaan tenant, dan permission viewAny; context request sebelumnya dipulihkan setelah evaluasi. Regresi baru mengunci batas tersebut.
- Medium, diperbaiki: `pupitre:ui` memakai spawn args-array tanpa shell; nama komponen diverifikasi sebelum fetch, dan URL registry dibatasi ke HTTPS, HTTP loopback, atau file lokal tanpa kredensial/query/fragment.
- High, diperbaiki: `create-pupitre-plugin` menolak traversal parent pada `--dir`/nama serta symlink target/template output, termasuk pada `--force`; direktori absolut eksplisit tetap didukung.
- High, diperbaiki: build registry gagal jika menemukan path sensitif, symlink, atau pola secret yang dikenali. Pemindaian pola bukan jaminan pendeteksian seluruh secret; review sumber sebelum publikasi tetap diperlukan. Registry HTTPS kustom merupakan sumber kode yang harus dipercaya pengguna.

### Upload dan pembatasan autentikasi

- High, diperbaiki: upload resource/page/plugin/editor mempunyai batas default 10 MiB, avatar 5 MiB, CSV 10 MiB. Ukuran aktual tempfile diperiksa dengan `stat` sebelum alokasi, pembacaan dibatasi dan pertumbuhan file ditolak; handle selalu ditutup.
- MIME diidentifikasi memakai magic bytes `file-type`, bukan deklarasi browser. SVG, HTML/XHTML dan JavaScript ditolak secara eksplisit; avatar/editor hanya menerima gambar pasif. Regresi PNG palsu berisi SVG/HTML menguji resource, avatar endpoint, dan upload profile langsung. CSV import private; download CSV/failed-row CSV memakai attachment serta `nosniff`.
- High, diperbaiki: reset-request/consume, registrasi, resend email, setup/confirm MFA, serta registrasi passkey dibatasi 5 percobaan per menit; challenge/recovery/disable MFA mempertahankan budget pengguna yang sudah ada. Login, options/verify login passkey, dan callback sosial memakai quota IP/panel 60 per menit karena juga menghitung sign-in sukses di IP bersama/NAT kantor. Login password menambahkan window kegagalan per email+IP 5 per menit yang dibersihkan saat sukses. Auth login/signup host example memakai driver limiter yang sama sebelum validasi/credential work.
- Limiter host yang terpasang tetapi gagal tidak diabaikan. Tanpa adapter host auth memakai fallback in-memory per proses maksimum 10.000 key; kapasitas penuh mengeviksikan key tertua menurut urutan penyisipan agar identitas baru tidak terkunci secara global. Tradeoff: trafik identitas baru yang tinggi dapat melupakan window aktif tertua sebelum kedaluwarsa; shared store wajib untuk pembatasan yang kuat pada trafik tersebut. Login sukses membersihkan budget credential, bukan quota endpoint/IP; rotasi email tidak melewati quota IP selama key masih tersimpan.
- Review konfirmasi memperbaiki respons throttle untuk form HTML/Inertia: quota tetap dikonsumsi, `Retry-After` tetap tersedia, lalu field error/toast dan redirect-back memakai protokol form yang sudah ada. Pemanggil JSON tetap menerima 429; modal raw JSON tidak dipakai untuk form.
- Risiko residual: restart mereset fallback in-memory; multi-worker/multi-instance **wajib** memasang shared-store `@adonisjs/limiter`. Konfigurasi trusted proxy/IP host harus benar. Batas upload tidak menggantikan quota storage dan pembatasan body parser/proxy milik host.

### Bukti verifikasi akhir

Hasil akhir berikut menggantikan jumlah tes pada run awal di atas: **8 functional example lulus**, SQLite terisolasi `tmp/security-test.sqlite`, dengan **152 pasangan rute/method mutasi** dan **304 penolakan token** (ditambah regresi Inertia 403). Perintah memakai `NODE_OPTIONS=--conditions=@rikology/source NODE_ENV=test LOG_LEVEL=error DB_TEST_DATABASE=$PWD/tmp/security-test.sqlite node ace test functional` agar tidak bergantung pada build yang sedang dibersihkan agent performa.

Paket/regresi targeted: core **67**, pupitre-react **2**, Shield **12**, Audit **12**, Transmit **11**, scaffold **5**, registry Node test **3** — semuanya lulus (**112 tes**, di luar 8 functional). Typecheck ketujuh workspace terkait termasuk frontend example lulus; ESLint dan Prettier source/spec yang disentuh menjadi gerbang akhir. Tes baru menguji MIME spoof/ukuran aktual, limiter installed/fallback dan form negotiation, delegation/revocation, snapshot/rollback, queued authorization, tenant/subject/channel isolation, URL/argv/scaffold path, secret publication, XSRF dan probe CSP.

E2E CSP tidak dijalankan oleh agent keamanan; gerbang browser lengkap milik orchestrator. Audit ini tidak menjamin seluruh aplikasi host/custom plugin aman; konfigurasi produksi dan source registry tambahan tetap perlu audit sendiri.

### Kebijakan pengungkapan

`SECURITY.md` mendukung patch terbaru versi 1.x dan mengarahkan laporan ke GitHub private security advisories `rikoriswandha/pupitre`. Host bertanggung jawab atas Shield, konfigurasi limiter, storage, policy domain, tenant membership, dan kredensial produksi.


## Performa & paket

### Metode dan batas bundle

Pengukuran memakai output Vite example, `node:zlib` pada Node, gzip level 9 dan Brotli quality 11. Angka adalah **byte**, dijumlahkan per file setelah kompresi, bukan kompresi konkatenasi. Graph awal mencakup entry `inertia/app.tsx` beserta seluruh import statis transitif; CSS dideduplikasi dari graph yang sama. Grup lazy mencakup static closure semua root fitur, dikurangi file graph awal. Shared chunk dapat muncul pada beberapa grup (termasuk halaman admin bila bundler membuat dependensi balik); angka grup tidak boleh dijumlahkan sebagai total transfer atau dianggap biaya tambahan fitur setelah halaman admin sudah di-cache.

| Graph / fitur | Gzip terukur | Budget gzip | Brotli terukur | Budget Brotli |
| --- | ---: | ---: | ---: | ---: |
| JS awal | 125318 | 137850 | 108822 | 119705 |
| CSS awal | 10847 | 11932 | 9364 | 10301 |
| TipTap rich editor | 354552 | 390008 | 297706 | 327477 |
| CodeMirror | 262624 | 288887 | 226396 | 249036 |
| Recharts (`WidgetChartBody`) | 328974 | 361872 | 271163 | 298280 |
| Markdown (`marked` + DOMPurify) | 24527 | 26980 | 22187 | 24406 |
| Image cropper | 224475 | 246923 | 184884 | 203373 |
| Transmit client | 218879 | 240767 | 179822 | 197805 |
| Chunk lazy terbesar (`pupitre-BuvQ467K.js`) | 214357 | 235793 | 175763 | 193340 |

Budget committed `tools/bundle-budget/budgets.json` memakai `ceil(terukur × 1.10)` (headroom 10%, pembulatan byte). `npm run bundle:budget` menjalankan regresi lalu mencetak tabel readable dan gagal untuk ukuran berlebih, fitur berat yang hilang/tidak reachable, atau fitur yang masuk import statis entry/halaman admin. CI menjalankannya langsung sesudah build example. Regresi bundle lama `apps/example/e2e/14_bundle.spec.ts` **dipertahankan**, bukan dihapus.

Tabel budget adalah refresh build terakhir setelah sumber security/a11y stabil. Perbandingan terkendali di bawah merekam snapshot sebelum refresh terakhir; refresh menambahkan perubahan audit paralel kecil pada JS/CSS tanpa mengubah hasil laziness. JS awal final 515231 byte raw, CSS 54467 byte raw, chunk terbesar 714254 byte raw.

### Temuan dan sebelum/sesudah

- **Medium, diperbaiki — `apps/example/inertia/pages/pupitre.tsx`:** Transmit semula di-import statis oleh halaman admin dan instancenya selalu dibuat, walau realtime tidak digunakan. Import sekarang dinamis setelah shared prop `pupitre.realtime.driver` bernilai `transmit`; callback dibatalkan bila page tidak lagi aktif. Chunk client terpisah: 8016 raw / 2711 gzip / 2410 Brotli byte. Gate menolak bentuk sebelum perbaikan karena tidak ada chunk Transmit lazy yang dapat diidentifikasi; regresi fixture juga menolak client statis di halaman Inertia meski entry utama tetap lazy.
- **Low, diperbaiki — `packages/pupitre/tsconfig.build.json` dan `package.json`:** dry-run awal membawa tiga deklarasi `build/tmp/configure-*/{adonisrc,start/kernel,vite.config}.d.ts` dari fixture configure. Tambahkan `tmp` ke exclude deklarasi dan `!build/tmp` ke daftar files publikasi; gate tarball kini menolak semua tmp/test internal/coverage/node_modules dan memverifikasi aset rilis. Regresi mengunci kedua exclude tersebut serta penolakan file fixture.
- **Medium, diperbaiki — `tools/verify-exports`:** cek lama hanya menolak `build/node_modules`; bare import eksternal yang kebetulan tersedia lewat hoisting dapat lolos. Parser TypeScript kini memeriksa import/re-export/dynamic import/require literal seluruh JS build, menolak devDependency-only, dan resolve memakai kondisi ESM dari lokasi file. Optional peer boleh tidak terpasang; ekspor/path rusak pada peer yang terpasang tetap gagal. Tidak ditemukan dependency runtime yang perlu ditambahkan; **tidak ada perubahan deklarasi dependency atau sinkronisasi lockfile dari audit performa ini**.

| Pengukuran terkendali | Sebelum: raw / gzip / Brotli | Sesudah: raw / gzip / Brotli |
| --- | ---: | ---: |
| JS awal | 515087 / 125261 / 108776 | 515087 / 125261 / 108774 |
| CSS awal | 54470 / 10850 / 9395 | 54470 / 10850 / 9395 |
| Chunk halaman admin terbesar | 721262 / 216374 / 177494 | 713460 / 214058 / 175628 |
| Chunk Transmit terpisah | Tidak ada; menyatu di halaman admin | 8016 / 2711 / 2410 |

Baseline terkendali dibangun dengan wiring Transmit statis lama, lalu wiring lazy dipulihkan dan build final dijalankan. Audit a11y/security berlangsung paralel; selisih halaman admin bukan klaim seluruhnya berasal dari Transmit. Initial entry memang tidak pernah membawa client tersebut: manfaat perbaikan ada pada halaman admin yang tidak memakai realtime, bukan pengurangan initial entry. `npm ls react react-dom zod cmdk date-fns @adonisjs/transmit-client` menunjukkan React/React DOM 19.3.0 dan Zod 4.6.5 deduped; tidak ada date-fns di tree. cmdk tetap digunakan oleh global search halaman admin, bukan graph statis entry. Chart/editor/cropper sudah lazy sebelum audit; tidak diubah.

### Inventaris paket dan bukti gate

`npm pack --dry-run --json -w <package>` dijalankan untuk semua tujuh package publishable, tanpa install dan tanpa membuat tarball permanen. Inventaris akhir:

| Package | File | Tarball byte | Unpacked byte |
| --- | ---: | ---: | ---: |
| `@rikology/pupitre` | 315 | 258779 | 2715284 |
| `@rikology/pupitre-react` | 46 | 33015 | 157742 |
| `@rikology/pupitre-ui` | 273 | 176442 | 899299 |
| `@rikology/pupitre-shield` | 26 | 10803 | 34688 |
| `@rikology/pupitre-audit` | 6 | 6690 | 19360 |
| `@rikology/pupitre-transmit` | 7 | 5126 | 13948 |
| `@rikology/create-pupitre-plugin` | 17 | 5390 | 13496 |

Stubs + `commands.json` core/Shield, stylesheet UI, `registry/public/{registry.json,r/*.json}`, dan template generator termasuk test template tersedia. `registry/registry.json` sengaja disertakan sebagai manifest index; registry tooling/source junk tidak ikut. Subpath testing yang dipublikasikan merupakan API test untuk konsumen, bukan suite test internal.

- `npm run build`: lulus setelah perbaikan typing lintas audit.
- `node ace build --ignore-ts-errors` example: build final exit 0 tanpa diagnostik TypeScript. Diagnostik slice security/a11y yang sempat muncul pada build sementara sudah diperbaiki pemiliknya; flag tersebut tetap bukan pengganti gate typecheck.
- `npm run bundle:budget`: empat regresi fixture dan gate build lulus.
- Uji negatif budget final memakai salinan JSON sementara dengan `initialJS.gzip = 125317`: command exit 1, `125318 > 125317 bytes`; file sementara dihapus, budget committed tidak diubah. Uji snapshot awal juga menolak `125261 > 125260 bytes`.
- `npm run verify:exports`: **139 cek lulus, 0 gagal**, termasuk seluruh dry-run tarball dan 269 file runtime JS; suite regresi tool kini mencakup lima tes dan semuanya lulus. CLI pada package sementara dengan import `undeclared-runtime` exit 1; peer opsional yang dideklarasikan lolos, dependency wajib yang tidak resolve serta subpath peer terpasang yang tidak diekspor tetap ditolak. Fixture dihapus oleh cleanup test.
- ESLint dan Prettier dijalankan untuk file tool dan wiring halaman yang dimiliki audit performa; suite E2E example tidak dijalankan oleh agent ini.

Risiko residual: chunk halaman admin final masih 714254 byte raw dan Vite memberi warning >500 kB; warning tidak disembunyikan, ukuran dikunci oleh budget lazy. Budget entry bukan keseluruhan biaya boot halaman admin yang dipilih Inertia, dan bukan pengukuran LCP/INP/CLS atau memory. Manifest mengidentifikasi batas fitur dari source/root chunk yang diekspor Vite, bukan atribusi setiap modul vendor dalam shared chunk; perubahan bundler perlu review hasil graph. Scanner deklarasi mencakup specifier literal yang bisa dianalisis statis, bukan nama modul hasil kalkulasi runtime. Compression/CDN nyata tetap menjadi tanggung jawab host.


## Gerbang akhir 1.0 (2026-10-11)

Dijalankan orchestrator setelah review adversarial → remediasi → konfirmasi, pada working tree final (versi `1.0.0`, `catalogVersion` `1.0`):

| Gerbang | Hasil |
| --- | --- |
| `npm run typecheck` (semua workspace) | lulus |
| `npm run lint` | lulus |
| Japa SQLite: core / react / shield / audit / transmit / create-pupitre-plugin / ui | 363 / 56 / 17 / 12 / 12 / 5 / 3 lulus |
| `npm run build` + `npm run verify:exports` | lulus; 140 cek, termasuk catalog hasil build tanpa probe `Function` |
| `npm run registry:check` | lulus (87 item) |
| `node ace build` example + `npm run bundle:budget` | lulus |
| Playwright CT `pupitre-ui` | 188/188 lulus |
| E2E example (`CI=1 npm run e2e`) | 48/48 lulus |
| Docs `npm run check` + `npm run build -w apps/docs` | lulus (35 halaman) |

Tindak lanjut audit 2026-10-12: residual fixture PostgreSQL diperbaiki. Penyebab utamanya adalah schema builder Knex yang digunakan ulang (statement lama ikut dieksekusi ulang), bukan kebutuhan menjalankan migrasi dua kali: `140_relations` kini memakai builder baru untuk setiap `hasTable`/`createTable`, dan `setupDatabase()` memprioritaskan promise inisialisasi agar pemanggil berikutnya tidak mendapat database setengah siap. Regresi mencakup kesiapan schema untuk pemanggil bersamaan, migrasi relasi berulang, dan foreign key yang tetap aktif. Audit diuji terpisah dengan peer asli: ID subjek historis yang tidak sesuai tipe primary key PostgreSQL kini tetap dirender tanpa tautan; error `22P02` pada lookup record route dipetakan ke 404, bukan 500. Assertion pencarian relasi menguji hasil case-insensitive lintas dialect, bukan binding SQL khusus SQLite. Job CI `test-pg` menjalankan seluruh suite core pada PostgreSQL 16; database lokal untuk verifikasi selalu sementara dan namanya mengandung `test`.

Verifikasi tindak lanjut: PostgreSQL 17.5 lokal (`DB=pg npm run quick:test`) dan SQLite (`npm test`) masing-masing lulus 387/387 tes core. Gate c8 85% lines berjalan terpisah untuk compiler (93,03%), query (96,69%), dan authz (92,94%). Docs lulus 2 tes Node, `astro check` tanpa diagnostik, dan build 35 halaman; CI kini menjalankan ketiganya. Build docs masih memberi warning konflik route `/404` yang tidak menggagalkan build.
