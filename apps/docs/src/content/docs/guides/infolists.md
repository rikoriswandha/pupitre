---
title: "Infolists"
description: "Create read-only resource view schemas with formatted entries, layouts and related record information."
---

An infolist is a read-only schema for the resource view page. Add `.infolist((s) => [...])`; Pupitre adds a view page if it is missing.

![Field Notes 01 record view with a published badge, summary and body, publication timestamp, views and two line items.](/screenshots/post-view-light.webp)

```ts
.infolist((s) => [
  s.section('Post').components([
    s.textEntry('title').copyable(),
    s.textEntry('price').money('USD'),
    s.textEntry('publishedAt').dateTime().timezone('Asia/Jakarta'),
    s.textEntry('body').markdown(),
    s.badgeEntry('status').options({ draft: 'Draft', published: 'Published' }),
    s.iconEntry('published').boolean(),
    s.imageEntry('cover').circular(),
  ]),
])
```

The complete entry catalog is `textEntry`, `badgeEntry`, `iconEntry`, `imageEntry`, `colorEntry`, `keyValueEntry`, `repeatableEntry` and `codeEntry`, each created with an attribute name. `textEntry` supports label, badge, copyable, url, date/dateTime/timezone/since, money, limit, markdown and options. `badgeEntry` supports colors and options. `iconEntry` supports boolean icons and colors; `imageEntry` supports circular presentation; repeatable entries accept an entry schema.

Stored enum values (`draft`, `published`) display as-is unless you pass `.options(...)`. It accepts the same shapes as a select field (`{ draft: 'Draft' }`, `{ draft: { label: 'Draft' } }` or `[{ value, label }]`), so you can share one constant between the form, table and infolist. The server maps the value, or each item of an array value, to its label; unknown values stay unchanged. `colors` stay keyed by the stored value.

Use the same grid/section/fieldset/tabs/group/split/fragment layouts as forms. Infolists format values on the server. Markdown entries render server-sanitized HTML; they do not accept arbitrary HTML supplied by the browser. Available methods differ by entry kind: for example, `codeEntry` is not a `codeEditor` field and does not expose all editor methods. See the exact [entry interfaces](/reference/api-schema/).

## Rendering rich-editor content

Use `.html()` for sanitized HTML or `.richContent(...)` to resolve rich-editor merge tags and
custom blocks. Both run the server rich-content renderer; unknown custom blocks are omitted.
The saved HTML and configuration never become an executable template.

```ts
import { renderRichContent } from '@rikology/pupitre'

s.textEntry('body').richContent(({ record }) => ({
  mergeTags: { name: String(record.customerName ?? ''), today: '2026-10-13' },
  blocks: [callout],
}))

const html = renderRichContent(post.body, {
  mergeTags: { name: customer.name, today: 2026 },
  blocks: [callout],
})
```

`callout` is the application-owned `richBlock(...)` definition used by the editor.
`mergeTags` maps identifiers to strings or numbers. Values are HTML-escaped, including quotes;
unresolved tags remain readable as `{{ identifier }}`. Mentions remain safe, labelled spans.
Block renderers receive `{ config }` and produce escaped text unless their definition explicitly
opts into `.rawHtml()`. Even opted-in markup is sanitized, so scripts, event handlers, and
unsafe URL schemes cannot survive. Only renderers supplied by your application execute.

