# ADR-0002: Reaktivitas client-first tanpa eval string

- Status: Accepted
- Tanggal: 2026-10-10

## Konteks
Filament mengevaluasi `visible`/`afterStateUpdated` di server lewat Livewire round-trip. Pupitre memakai Inertia, round-trip per keystroke terlalu mahal. Namun closure TypeScript developer tidak bisa dikirim ke browser begitu saja.

## Keputusan
1. Compiler mencoba *mengangkat* closure menjadi ekspresi json-render dengan proxy perekam (`get('status') === 'published'` → `$cond`).
2. Yang tidak terangkat: `visible/disabled/label` → dievaluasi sekali di server (`static`); `afterStateUpdated` → `server: true` (`POST /_pupitre/evaluate`).
3. Aritmatika/format sederhana → `$computed` dengan **fungsi terdaftar** di catalog. **Tidak ada** pengiriman fungsi sebagai string dan tidak ada `new Function`/`eval` di client. Ini mengoreksi kalimat di DESIGN v0.
4. `pupitre:inspect` melaporkan hasil per closure.

## Alternatif yang ditolak
- Fungsi sebagai string + `new Function` — bentrok CSP Shield (`unsafe-eval`), sulit di-audit, dan membuka eksekusi kode kalau spec pernah berasal dari sumber lain.
- Semua reaktivitas di server — latensi, beban server, dan state form rapuh saat reload.
- Mewajibkan developer menulis ekspresi JSON manual — DX buruk, bukan "builder".

## Konsekuensi
- Daftar fungsi `$computed` bawaan harus cukup untuk kasus umum (CATALOG §6) dan bisa ditambah host via registry.
- Test tabel kasus lifter (TESTING §2) adalah kontrak; closure yang berubah hasil lift-nya adalah breaking change minor.
- CSP example app dijalankan tanpa `unsafe-eval` di CI sebagai penjaga.
