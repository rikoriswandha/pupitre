---
title: Infolists
sidebar:
  order: 4
---

An infolist is a read-only schema for the resource view page. Add `.infolist((s) => [...])`; Pupitre adds a view page if it is missing.

```ts
.infolist((s) => [
  s.section('Post').components([
    s.textEntry('title').copyable(),
    s.textEntry('price').money('USD'),
    s.textEntry('publishedAt').dateTime().timezone('Asia/Jakarta'),
    s.textEntry('body').markdown(),
    s.iconEntry('published').boolean(),
    s.imageEntry('cover').circular(),
  ]),
])
```

The complete entry catalog is `textEntry`, `badgeEntry`, `iconEntry`, `imageEntry`, `colorEntry`, `keyValueEntry`, `repeatableEntry` and `codeEntry`, each created with an attribute name. `textEntry` supports label, badge, copyable, url, date/dateTime/timezone/since, money, limit and markdown. `iconEntry` supports boolean icons and colors; `imageEntry` supports circular presentation; repeatable entries accept an entry schema.

Use the same grid/section/fieldset/tabs/group/split/fragment layouts as forms. Infolists format values on the server. Markdown entries render server-sanitized HTML; they do not accept arbitrary HTML supplied by the browser. Available methods differ by entry kind: for example, `codeEntry` is not a `codeEditor` field and does not expose all editor methods. See the exact [entry interfaces](/reference/api-schema/).
