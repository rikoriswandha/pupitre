# Changelog

## Unreleased

- Add a fail-closed, tenant-aware Media resource with thumbnail grids, search/type/date filters, multi-file uploads, metadata editing, and original/conversion cleanup on delete.
- Add immutable mediaPicker/mediaEntry/mediaColumn catalog extension factories, ordered multi-selection, MIME/count/ownership validation, and private signed thumbnails.
- Reuse Pupitre's owned-upload pipeline and expose an authenticated media browse/adoption protocol for inline uploads.
- Add lazy optional Sharp conversions, a default 320px WebP thumbnail, and original-only fallback without Sharp.
