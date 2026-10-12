# ADR-0025: Filter QueryBuilder dan multi-sort berbasis URL

- Status: Accepted
- Tanggal: 2026-10-12

## Konteks

ADR-0004 menetapkan URL sebagai sumber state tabel. Filter kompleks membutuhkan OR antar kelompok tanpa membocorkan scope tenant atau menerima nama atribut SQL dari client. Sort tunggal harus tetap kompatibel dengan URL dan descriptor yang sudah dipakai host.

## Keputusan

`table.filter.queryBuilder(name).constraints([...])` mendaftarkan constraint immutable dari `qb.text`, `number`, `date`, `boolean`, `select`, dan `relationship`. Nama publik, label, tipe, opsi, serta operator masuk descriptor. Atribut fisik, nama relasi yang digunakan query, dan konfigurasi timezone tetap server-only; input URL hanya memilih constraint terdaftar.

`filters[name]` berisi string JSON ketat berbentuk `{ groups: [[{ constraint, operator, value?, negated? }]] }`. Rule dalam kelompok memakai AND; kelompok memakai OR. `negated` harus boolean. Nilai harus cocok dengan tipe/operator; JSON rusak, nama/operator tidak dikenal, dan batas terlampaui ditolak, bukan dianggap query kosong. Reset menghapus parameter filter, bukan mengirim kelompok kosong sebagai filter aktif.

Batas parser: 8 kelompok, 16 rule per kelompok, 64 rule total, 500 karakter per string scalar, 50 nilai pilihan, dan 8.192 byte UTF-8 JSON serialized. Server juga membatasi query JSON setelah encoding URL ke 8.192 byte sebagai envelope konservatif; proxy/host tetap dapat menerapkan batas URL keseluruhan yang lebih rendah. Nama atribut dan SQL tidak dapat ditentukan client.

Parser menggabungkan kembali array string hasil `qs` dengan koma sebelum memvalidasi `sort` dan JSON query. URL tulisan tangan `?sort=title,-price` tetap sah tanpa encoding koma.

Constraint angka menolak nilai non-finite dan nilai di luar rentang safe integer JavaScript. `.integer()` eksplisit membatasi nilai ke integer signed 32-bit untuk kolom PostgreSQL `integer`; kolom decimal memakai `.number()` biasa. Count relasi wajib safe integer nonnegatif. Tidak ada inferensi tipe integer dari metadata Lucid yang tidak mendeskripsikan lebar tipe SQL.

Seluruh OR dibungkus satu kelompok `where` di query tabel yang telah menerapkan scope resource/tenant, ability, tab, dan soft-delete. Relasi menggunakan query relasi Lucid, bukan join yang memperbanyak baris parent. Negasi tidak memindahkan predicate keluar scope. Daftar, ringkasan, ekspor sinkron maupun job ekspor membangun ulang filter dari URL yang sama.

Nilai tanggal adalah kalender `YYYY-MM-DD`. Zona constraint eksplisit mengalahkan zona efektif request (`ctx.pupitre.timezone`), dengan fallback UTC. Batas awal/akhir hari dihitung di zona efektif lalu dikonversi UTC; `on` dan rentang mencakup hari kalender, termasuk hari DST yang bukan 24 jam. Jangan menambahkan 24 jam UTC untuk menghitung hari berikutnya. Nilai tanggal invalid ditolak.

Tahun kalender nol serta batas hari lokal yang jatuh pada tahun UTC nol ditolak sebelum binding SQL. Kedua operand LIKE memakai `lower()` SQL yang sama; SQLite tanpa ICU tidak menjanjikan case folding Unicode, tetapi teks kapital non-ASCII yang persis sama tetap cocok.

Predicate kalender memakai rentang setengah-terbuka `[awal hari, awal hari berikutnya)`, bukan timestamp akhir hari berpresisi tetap. Ini menjaga batas tengah malam SQLite yang disimpan tanpa pecahan detik dan timestamp PostgreSQL berpresisi mikrodetik.

Kolom Lucid yang dideklarasikan dengan `@column.date()` tetap dibandingkan sebagai `YYYY-MM-DD` tanpa pergeseran UTC, sesuai ADR-0009. Kolom datetime memakai batas UTC di atas.

Batas datetime PostgreSQL dibind sebagai ISO UTC ber-offset agar `timestamptz` tidak bergantung `TimeZone` session. SQLite memakai representasi UTC tanpa offset agar perbandingan tekstual terhadap timestamp Lucid tetap tepat.

`.multiSort(max = 3)` mengaktifkan sort berprioritas dengan URL `sort=title,-price`. Kolom tetap wajib terdaftar dan `sortable()`, jumlah mengikuti batas tabel, dan urutan URL menentukan prioritas. `.defaultSort(column, direction)` tetap didukung; overload array menerima `{ column, direction }[]`. Descriptor tetap membawa `defaultSort` primer dan menambahkan `defaultSorts` serta `multiSort`. URL sort tunggal lama tidak berubah; tanpa opt-in tabel tetap sort tunggal. Parameter `sort=` secara eksplisit menghapus default, berbeda dari parameter yang tidak ada. Hanya header primer memiliki `aria-sort`; kontrol tambahan menyatakan prioritas dan dapat dioperasikan lewat keyboard.

Builder memvalidasi batas dan duplikasi sort default saat `toDefinition()`, setelah seluruh rantai konfigurasi selesai. Menghapus sort pengguna tetap mempertahankan urutan alami kolom `.reorderable()` agar operasi reorder tidak menyimpan urutan heap database.

Urutan implisit `.reorderable()` bukan default sort descriptor dan tidak ikut token URL ketika user menambah sort. Tombol clear hanya muncul pada tabel multi-sort. Pada `.deferFilters()`, editor query langsung men-stage rule lengkap ke draft bersama filter lain; satu tombol Apply tabel mengirim semuanya. Penghapusan rule/grup mengembalikan fokus ke tombol tambah di editor.

## Alternatif yang ditolak

- Predicate SQL atau atribut bebas dari client: melanggar batas trust server dan tenant.
- OR pada query luar: dapat melewati scope tenant atau soft-delete.
- Menyimpan filter di session: tidak shareable dan hilang dari riwayat URL.
- Mengganti `defaultSort` dengan array saja: mematahkan consumer descriptor lama.

## Konsekuensi

Host harus mendaftarkan constraint secara eksplisit dan memilih timezone kalender dengan sadar. Editor client tidak menggantikan validasi server. URL dapat panjang dan mengungkap nilai pencarian kepada log/proxy; jangan gunakan filter URL untuk rahasia. Pengujian konsumen mencakup OR, reload URL, ekspor terfilter, scope tenant, timezone/DST, input invalid, serta sort keyboard dan kompatibilitas sort tunggal.
