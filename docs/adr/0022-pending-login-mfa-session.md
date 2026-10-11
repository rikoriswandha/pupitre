# ADR-0022: Pending login MFA continuation in session

- Status: Accepted
- Tanggal: 2026-10-11

## Konteks

Password dan social authentication dapat berhasil sebelum tantangan MFA selesai. Membuat sesi guard pada tahap awal berarti request terlindungi bisa berjalan sebelum faktor kedua dibuktikan. Menaruh data autentikasi pada URL atau body challenge juga membuka peluang kebocoran dan pemalsuan.

## Keputusan

`completeLogin(ctx, panel, user, options)` tidak membuat sesi guard bila pengguna memiliki MFA aktif. Ia menyimpan marker `pupitre.pendingLogin` di session server-side yang berisi id user, guard, pilihan remember, redirect relatif aman, serta waktu kedaluwarsa lima menit. Marker hanya dapat digunakan satu kali; setelah TOTP atau recovery code berhasil, marker dihapus lalu login guard diselesaikan. Passkey assertion terverifikasi dapat melewati challenge sebagai faktor kedua yang memenuhi syarat.

## Alternatif yang ditolak

- Login guard sebelum MFA — membuka akses terlindungi sebelum faktor kedua diverifikasi.
- Membawa user id/redirect/challenge melalui URL — data dapat dibocorkan atau dimanipulasi, dan replay lebih sulit dibatasi.

## Konsekuensi

- Pending login mengikuti keamanan dan penyimpanan session host, tanpa tabel tambahan.
- Marker kedaluwarsa otomatis secara logis dan dibuang saat challenge gagal karena expiry atau sukses.
- Redirect tetap dibatasi ke path same-origin melalui validasi `safeRedirect`.
