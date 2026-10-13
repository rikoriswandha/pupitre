# @rikology/pupitre-media

Reusable, tenant-aware media for Pupitre. The package is server-only; its `/catalog` export contains only Zod schemas. The picker UI lives in `@rikology/pupitre-ui` and is loaded lazily.

## Install

```sh
node ace add @rikology/pupitre-media
node ace migration:run
```

Configure an Adonis Drive disk and install `sharp` if image dimensions and conversions are required. Without this optional peer, originals remain usable and conversions are empty.

```ts
import { media, mediaPicker, mediaEntry } from '@rikology/pupitre-media'

panel.plugins([
  media({
    disk: 'uploads', directory: 'media', visibility: 'private',
    maxFileSize: 10 * 1024 * 1024,
    acceptedFileTypes: ['image/*'],
    conversions: { thumb: { width: 320, format: 'webp' } },
    navigationGroup: 'Content', tenancy: true,
    authorize: (ctx, ability, record) => editorialMediaAccess(ctx, ability, record),
  }),
])

mediaPicker('coverMediaId').accept(['image/*']).conversion('thumb')
mediaPicker('gallery').multiple().maxItems(5).accept(['image/*'])
mediaEntry('coverMediaId').conversion('thumb')
```

The host must provide the referenced `editorialMediaAccess` authorization function. Without an `authorize` callback, configure a `MediaPolicy` in Pupitre's policy loader with `viewAny`, `view`, `create`, `update` and `delete` abilities. Missing policy/ability fails closed. Each ability receives the normal authenticated Bouncer user, and record abilities receive `PupitreMedia`.

Browser registration:

```ts
import { mediaCatalog } from '@rikology/pupitre-media/catalog'
import { components } from '@rikology/pupitre-ui'
import { defineRegistry } from '@rikology/pupitre-react'
const registry = defineRegistry(components, { extensions: [mediaCatalog] })
```

## Persistence and security

Single pickers store a nullable integer ID. Multiple pickers store an ordered array of integer IDs; use an explicitly JSON-prepared/consumed model column on both SQLite and PostgreSQL. IDs must exist in the current tenant, pass resource `viewAny` and record `view`, satisfy the accepted MIME types, and obey the item limit. Duplicates and forged IDs are rejected server-side.

The Media resource offers a thumbnail grid, filename/alt search, MIME/date filters, multi-file header upload, metadata edit/view, delete and bulk delete. Uploads use core Pupitre's MIME sniffing, size ceiling, session ownership and consumption tracking. Active content including SVG is rejected. Images default to a 320px WebP `thumb`; named conversions can set width, optional height, and WebP/JPEG/PNG format. `conversions: false` disables generated files. Private objects and conversions use the core 30-minute signed URL resolver.

Overlapping attempts to adopt one upload create at most one library record. A failed adoption removes its own conversions, but preserves the original when another adoption already owns it.

`tenancy: true` requires an active panel tenant and scopes rows by `tenant_id`; do not use this on a panel without tenancy. `tenancy: false` explicitly leaves media global, bypassing automatic tenant scoping. Storage cleanup removes the original and every generated conversion when library records are deleted. A nullable foreign key with `ON DELETE SET NULL` is recommended for single-picker columns. Multiple-ID JSON columns are host-owned: removed IDs cease to render and are rejected on subsequent saves.

## Protocol

`GET <panel-path>/_pupitre/media?q=...&ids[0]=...&conversion=thumb` returns authorized `{ rows }` with ID, filename, MIME, alt and signed thumbnail URLs. Results are bounded to 50 browse records or 100 explicitly requested IDs. `POST` to the same URL accepts `{ paths, filenames? }`, adopts only files uploaded for the Media resource's `path` field by the current session, and returns created rows. Inline upload first uses the existing `/_pupitre/upload` endpoint. These routes share the core authenticated, tenant-resolved panel route groups and CSRF protection; no public media lookup endpoint is registered.
