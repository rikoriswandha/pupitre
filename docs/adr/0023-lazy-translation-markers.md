# ADR-0023: Lokalisasi lazy berbasis request dengan key sumber Inggris

- Status: Accepted
- Tanggal: 2026-10-12

## Konteks

Definition panel/resource dimuat pada tingkat modul, sebelum ada request. Terjemahan saat builder dijalankan akan mengunci semua user pada satu bahasa dan berisiko mencampur locale antar request. UI React juga memerlukan terjemahan sinkron, sedangkan data record tidak boleh diterjemahkan hanya karena kebetulan sama dengan key katalog.

## Keputusan

`t(key: string, params?: Record<string, string | number>): string` memakai key literal berupa teks sumber Inggris. Server mengembalikan teks Inggris dengan parameter terinterpolasi serta intent key/params bertanda HMAC dalam karakter Unicode TAG tak terlihat (U+E0001 pembuka, U+E0002 pemisah, U+E0020–U+E007E payload ASCII, U+E007F penutup). Boundary menyelesaikan intent valid menurut locale request dan membuang seluruh framing, termasuk marker terpotong atau tidak terverifikasi. Client menyelesaikan key secara sinkron dengan dictionary shared `pupitre.messages`. Panel mendeklarasikan `.locale(default)` dan `.locales([...])`; prioritas user → session → Accept-Language → panel → `en` dibatasi locale panel. Placeholder memakai `{name}` dan plural `{ one, other, zero? }` dengan `Intl.PluralRules` pada `params.count`. `en` selalu memakai sumber Inggris plus override eksplisit, bukan fallback non-Inggris.

## Alternatif yang ditolak

- Terjemahan eager di builder — belum ada user/request dan bahasa yang ter-cache salah.
- Mutable locale global server — request konkuren dapat saling mencemari.
- Menerjemahkan semua string respons — mengubah isi record, identifier, URL, dan data host tanpa opt-in.
- Key simbolik terpisah — kehilangan teks sumber sebagai fallback dan menambah pemetaan yang tidak diperlukan.
- Key dinamis/template literal — katalog tidak dapat diinventarisasi lengkap dan interpolasi menjadi rapuh.

## Konsekuensi

**Breaking change:** `t()` server bukan lagi fungsi identitas. Hasilnya tetap terbaca dalam log, `Error.message`, regex dan `.includes()`, tetapi `t('Save') === 'Save'` tidak benar karena metadata tak terlihat. Definition bertanda tetap didukung; penggunaan di luar pipeline (email, Edge, penyimpanan DB, adapter custom) wajib memakai `resolveTranslations(value, locale, getMessages(config, panel, locale))` atau `captureTranslation`/`restoreTranslation` untuk intent persisten. Operasi string seperti truncation/wrap/case harus dilakukan setelah resolusi. String biasa tidak diterjemahkan. Kolom nullable `users.locale` opsional; host tanpa kolom memakai session. Endpoint switcher session-auth/CSRF menolak locale asing. `i18n:check` memeriksa key literal serta kelengkapan katalog.

Marker HTTP ditandatangani HMAC-SHA256 dengan `APP_KEY` agar teks record tidak dapat memalsukan terjemahan. Adapter inbox resmi menyimpan teks sumber plus metadata key/params dalam JSON notifikasi, bukan marker bertanda tangan. Error job menyimpan metadata serupa dalam `result`; boundary pembacaan menerbitkan marker baru. Rotasi `APP_KEY` tidak menghilangkan intent terjemahan persisten, dan pembaca inbox host tetap mendapatkan teks sumber terbaca.

Props Inertia diselesaikan sebagai data terstruktur melalui `inertia.page()` sebelum rendering penuh/SSR/serialisasi, termasuk shared props dan error validasi. Boundary string hanya membuang framing, tidak pernah menyisipkan terjemahan ke HTML/JSON yang sudah dirender. Karena itu escaping JSON/HTML dilakukan renderer tepat sekali. Payload ekspor antrean menyimpan header sumber plus `StoredTranslation`, bukan marker terikat `APP_KEY`.
