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

## CSS hooks

Tokens re-tint the default skin; CSS hooks let a theme `stylesheet` restyle structure (the ledger rule, unboxed sections, title serif) without copying components. Every structural element carries a stable `data-pupitre-<name>` attribute. Target it with an attribute selector:

```css
/* /admin-theme.css — registered via defineTheme({ stylesheet: '/admin-theme.css' }) */
[data-pupitre-section] {
  border-top: 0;
  border-radius: var(--radius);
  background: var(--card);
  box-shadow: var(--elevation-panel);
  padding: 1.25rem;
}
[data-pupitre-page-title] {
  font-family: var(--font-sans);
  font-weight: 600;
}
[data-pupitre-button][data-variant='solid'][data-color='primary'] {
  border-radius: 9999px;
}
```

Pupitre's own styles are Tailwind utilities inside the `utilities` cascade layer; an unlayered rule in your stylesheet wins over them at any specificity, so `!important` is unnecessary. The stylesheet loads after `@rikology/pupitre-ui/styles.css` and is removed when the panel unmounts. Hooks mark element identity, not appearance: class names on the same element are implementation detail and change between releases, hook names do not.

| Hook | Element |
| --- | --- |
| `shell`, `content`, `main`, `page-header`, `page-title`, `breadcrumbs`, `page-tabs`, `page-body` | Shell frame, `<main>`, page heading row, `<h1>`, breadcrumb `<nav>`, record sub-navigation, content stack. `shell` also carries `data-density` and `data-sidebar`. |
| `sidebar`, `topnav`, `topbar`, `brand`, `nav`, `nav-group`, `nav-item` | Desktop and mobile sidebar, top-navigation header, toolbar header, brand link, navigation `<nav>`, group `<section>`, item `<a>` (`aria-current="page"` when active). |
| `section`, `section-header`, `section-heading`, `section-body`, `section-footer` | Unboxed page region (widgets, view-page sections, schema sections) and its parts. |
| `tabs`, `tabs-list`, `tab`, `tabs-body`, `tab-panel` | Schema tabs; `tab` carries `aria-selected`. |
| `wizard`, `wizard-steps`, `wizard-step`, `wizard-body`, `wizard-footer` | Schema wizard. |
| `form`, `form-fields`, `form-actions`, `field`, `control` | `<form>`, its fields block and submit row; one field (label, control, error); input, textarea, input group, select trigger. |
| `infolist` | View-page infolist root. |
| `widgets`, `widget` | Widget grid and each cell (also the loading skeleton). |
| `table`, `table-toolbar`, `table-search`, `table-bulk`, `table-scroll`, `table-element`, `table-head`, `table-header`, `table-body`, `table-row`, `table-cell`, `table-group`, `table-summary`, `table-pagination`, `table-grid` | Data table root, toolbar, search input, bulk-action bar, scroll container, `<table>`, `<thead>`, `<th>`, `<tbody>`, `<tr>` (`data-selected` when checked), `<td>`, group heading row, summary row, pagination, grid layout. |
| `kanban`, `kanban-column`, `kanban-card` | Kanban board, column, card. |
| `button`, `badge`, `actions`, `panel`, `empty` | Button (`data-variant`, `data-color`), badge (`data-color`), action list (`data-appearance`), raised panel, empty state. |
| `popup`, `dialog` | Any floating surface (menus, selects, popovers, dialogs); `dialog` narrows to modals and slide-overs (`data-slide-over`). |
| `auth`, `auth-card` | Authentication pages: wrapper and form container. |

Hooks are rendering contracts: a registry replacement for a component should keep the hooks its default emits, or host stylesheets written against them stop matching.

## Environment colors

Panel `.environmentIndicator({ color: 'warning', label: 'Staging' })` adds an environment badge to the topbar and a thin strip at the shell top. Its six semantic colors use contrast-safe foreground/background pairs in both themes, independent of host token overrides. The visible label communicates the environment without relying on color. See [Panels](/guides/panels/#environment-indicator) for production defaults and async visibility.
