---
title: Theming
sidebar:
  order: 13
---

Define a reusable theme on the server, then attach it to a panel:

```ts
import { defineTheme } from '@rikology/pupitre'

const theme = defineTheme({
  darkMode: 'system',
  density: 'comfortable',
  sidebar: 'expanded',
  sidebarCollapsibleOnDesktop: true,
  contentWidth: '7xl',
  radius: '0.5rem',
  colors: { primary: 'oklch(0.58 0.18 290)' },
  font: { family: 'system-ui, sans-serif' },
  vars: { '--custom-accent': 'oklch(0.58 0.18 290)' },
  stylesheet: '/admin-theme.css',
})

// panel.theme(theme)
```

Theme fields: font family/URL, compact/comfortable density, expanded/collapsed/top-nav sidebar, desktop collapse toggle, content width (`md` through `7xl`, `full`, `screen`), colors, radius, custom CSS variables, stylesheet, light/dark/system mode and the accepted primary color property. Brand logoDark provides a separate dark logo; brand name/logo/favicon are panel branding, not theme fields.

Both `defineTheme()` and panel `.theme()` validate values. Color names must be identifier-like; custom variable names start with `--`. CSS containing unsafe delimiters or `url(...)` is rejected. Font/stylesheet URLs must be same-origin paths or HTTPS; themes are not raw inline CSS source. Keep your host Tailwind stylesheet and import `@rikology/pupitre-ui/styles.css` after Tailwind.

The default skin uses warm neutrals and a green primary. Every colored state derives from a handful of base tokens: setting `primary` (or `colors: { primary }`) also re-tints selection fills (`--primary-soft`), colored text (`--primary-ink`), focus rings and the first chart series, in both light and dark mode. The same pattern applies to `success`, `warning`, `destructive` and `info`. Override `--background`, `--card`, `--sidebar`, `--foreground`, `--border` or `--input` through `vars` to change the neutral layers; keep `--primary-foreground` readable on your primary.

The default skin is a **ledger**: content sits on the canvas, each region opens with an ink rule, and lines inside it are hairlines. Two tokens carry that identity and are independent of `primary`: `--rule` (the ink rule colour) and `--pupitre-font-display` (the serif used only for page titles). The title font is Source Serif 4 (OFL-1.1), bundled with `@rikology/pupitre-ui/styles.css` via `@fontsource/source-serif-4`, so it looks the same on every OS and is served from your own origin (CSP `font-src 'self'` is enough). Override the tokens through `vars`, for example `vars: { '--pupitre-font-display': 'var(--font-sans)' }` to keep titles in your sans. Hosts that render Pupitre components outside the panel shell should paint `body` with `var(--background)`, because ledger surfaces are transparent.

Use the registry for structural component changes, not theme tokens. The sidebar collapse/group state persists per panel; table column visibility persists separately. [Customizing UI](/customizing-ui/) explains replacement component ownership.

## Environment colors

Panel `.environmentIndicator({ color: 'warning', label: 'Staging' })` adds an environment badge to the topbar and a thin strip at the shell top. Its six semantic colors use contrast-safe foreground/background pairs in both themes, independent of host token overrides. The visible label communicates the environment without relying on color. See [Panels](/guides/panels/#environment-indicator) for production defaults and async visibility.
