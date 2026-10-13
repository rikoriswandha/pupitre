---
title: Media library
description: Reusable tenant-scoped media, image conversions, and accessible pickers.
---

The official `@rikology/pupitre-media` plugin adds a thumbnail-grid Media resource and reusable media IDs to your forms, tables, and infolists. React components ship in `pupitre-ui`, not the server package; the interactive picker is lazy-loaded.

## Setup

```sh
node ace add @rikology/pupitre-media
node ace migration:run
```

Configure an Adonis Drive disk, then register the plugin:

```ts
import { media } from '@rikology/pupitre-media'

panel.plugins([
  media({
    disk: 'uploads',
    directory: 'media',
    visibility: 'private',
    maxFileSize: 10 * 1024 * 1024,
    acceptedFileTypes: ['image/*'],
    navigationGroup: 'Content',
    tenancy: true,
    authorize: (ctx) => ctx.pupitre.user?.id === 1,
  }),
])
```

The callback receives `(ctx, ability, record?)`; implement application-specific checks for `viewAny`, `view`, `create`, `update`, and `delete`. Alternatively export `MediaPolicy` from your Pupitre policy loader. Missing policies and missing abilities deny access. Enable `tenancy` only on a tenant-enabled panel; all Media lookups, searches and picker validation then use the active tenant.

Register the shared catalog in your browser registry:

```ts
import { mediaCatalog } from '@rikology/pupitre-media/catalog'
const registry = defineRegistry(components, {
  extensions: [mediaCatalog],
})
```

Include `MediaPicker`, `MediaEntry`, and `MediaColumn` from the Pupitre UI component map (or their copied registry files). `/catalog` is Zod-only and safe to import in browser code.

## Reuse media on a record

```ts
import { mediaPicker, mediaEntry, mediaColumn } from '@rikology/pupitre-media'

mediaPicker('coverMediaId').accept(['image/*']).conversion('thumb')
mediaPicker('galleryIds').multiple().maxItems(5).accept(['image/*'])
mediaEntry('coverMediaId').conversion('thumb')
mediaColumn('coverMediaId').conversion('thumb')
```

A single picker stores a nullable integer ID. A multiple picker stores an ordered ID array; prepare/consume the model's JSON column explicitly for both PostgreSQL and SQLite. Keyboard buttons move selected items up/down and remove selections. Browsing supports filename/alt search; users can upload inline or through the library's multi-file header action.

IDs must exist, belong to the active tenant, pass `viewAny` and `view`, match the accepted MIME types, and fit the configured count. The server rejects duplicates, forged IDs and foreign-tenant IDs even when the browser payload is handcrafted.

## Conversions and private disks

Install the optional `sharp` peer for image dimensions and conversions. By default the library creates a 320px WebP `thumb`. Configure named conversions:

```ts
media({
  disk: 'uploads',
  conversions: {
    thumb: { width: 320, format: 'webp' },
    large: { width: 1600, height: 1200, format: 'jpeg' },
  },
  authorize: (ctx) => Boolean(ctx.pupitre.user),
})
```

Without Sharp, conversions are empty and original URLs are used. `conversions: false` disables generated files. Private originals and conversions use Pupitre's existing 30-minute signed URLs, refreshed by authorized picker/display lookups. SVG and other active content are rejected by the core MIME-sniffing upload pipeline, independent of the client extension or declared MIME type.

## Library lifecycle

The Media resource provides filename/alt search, MIME/date filters, metadata edit/view, delete and bulk delete. Deletion removes the original and every conversion. Use a nullable foreign key with `ON DELETE SET NULL` for single-ID columns. JSON arrays remain host-owned; deleted IDs stop displaying and fail subsequent form validation.

The picker protocol lives at `GET/POST <panel-path>/_pupitre/media`, inside the same authenticated, tenant-resolved route groups as core resources. GET returns only authorized rows with thumbnail URLs. POST adopts only session-owned `path` uploads created through the existing `/_pupitre/upload` endpoint. It never accepts a client disk, visibility, arbitrary file path or tenant ID.
