# ADR-0008: Integrasi package luar sebagai driver subpath dengan optional peer

- Status: Accepted
- Tanggal: 2026-10-10

## Keputusan
Interface adapter (`jobs`, `realtime`, `storage`, `mail`, `cache`, `tenancy`, `notifications`, `audit`) diekspor dari core. Driver resmi untuk `@adonisjs/queue`, `@rikology/adonisjs-tenant`, `-notifications`, `-audit-trail` tinggal di `@rikology/pupitre/drivers/*` sebagai subpath export dengan `peerDependenciesMeta.optional: true`, di-`import()` lazy. Plugin terpisah hanya untuk yang membawa UI/tabel sendiri (`shield`, `audit`, `transmit`).

## Alternatif yang ditolak
- Satu package per driver — `npm i` berantai, versi saling kejar.
- Hard dependency — host memasang Redis/queue yang tidak dipakai.

## Konsekuensi
- Import top-level optional peer dilarang (lint + `verify:exports` tanpa peer terpasang).
- Tanpa driver, fitur yang bergantung berjalan degradasi yang eksplisit (export sinkron + batas baris; hanya flash tanpa inbox) dan `pupitre:inspect` menyebutkannya.
