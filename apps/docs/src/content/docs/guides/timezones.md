---
title: "Timezones"
description: "Configure timezone precedence for datetime input and display while keeping stored instants in UTC and dates distinct."
---

Store datetime values in UTC and make display/parse timezone explicit. Precedence is component override, user timezone, panel timezone, then global Pupitre configuration (default UTC).

```ts
// Global: defineConfig({ timezone: 'UTC' })
// Panel: .timezone('Asia/Jakarta')
schema.dateTime('publishedAt').timezone('Europe/Amsterdam')
table.text('publishedAt').dateTime().timezone('Asia/Jakarta')
schema.textEntry('publishedAt').dateTime().timezone('Asia/Jakarta')
```

`auth.columns.timezone` identifies the host user's timezone attribute. Use valid IANA timezone names and Luxon/UTC-compatible model values. Table/infolist timestamps are formatted on the server; datetime form input is parsed back through its effective timezone. Avoid browser-local formatting of an already formatted wire value.

A date-only value is not the same as an instant; do not attach UTC midnight merely to display a calendar date. Test daylight-saving transitions with a zone that observes DST: nonexistent and ambiguous local datetime inputs need the server's validation, not a client-only conversion.
