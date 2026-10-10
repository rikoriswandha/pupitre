# ADR-0005: Monorepo npm workspaces

- Status: Accepted
- Tanggal: 2026-10-10

## Keputusan
npm workspaces (npm 11, Node 24), satu lockfile root, konsisten dengan `adonisjs-periscope`. Tidak memakai pnpm/turbo/nx di v1. Build lintas package via `npm run build --workspaces` dengan urutan array `workspaces`.

## Alternatif yang ditolak
- pnpm — lebih cepat, tetapi menambah toolchain berbeda dari package lain milik penulis; masalah symlink dengan Metro/Vite di beberapa host.
- Turborepo — belum perlu caching untuk ≤7 package.

## Konsekuensi
- Example app memakai `paths` + Vite alias untuk HMR lintas package (DEVELOPMENT §3).
- Kalau build menjadi lambat (>3 menit) di M4, evaluasi turbo tanpa mengubah package manager.
