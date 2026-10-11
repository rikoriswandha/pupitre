# Changelog

## Unreleased (1.0.0, milestone M4)

### Added
- Registry (WP40): deterministic shadcn registry generated from UI sources, versioned npm/import-graph dependencies, preserved relative targets, public `/r/*.json` payloads and index, CI drift check, and copy-ability tests.
- Audit (WP38): `Widget.Timeline` catalog renderer and exported `WidgetTimeline` display server-formatted activity times, actors, icons/colors, structured field changes, and empty states; `WidgetGrid` supports timeline spans and deferred data.
- Realtime (WP39): DataTable and NotificationTray replace polling with configured channel subscriptions, retain polling fallback, and clean up subscriptions and pending reloads on unmount.
- Realtime inbox (WP39): open notification trays refresh items on user-channel pings through the existing single subscription; superseded requests are aborted and late responses cannot overwrite the current inbox.
- Accessibility (WP42): strict WCAG 2.1 A/AA axe coverage across registry fixtures, shell/account components, dialogs and interactive popup/editor/table states, plus an example auth/CRUD/settings/security audit.

### Fixed
- Host styling (M4): namespace the example's card/focus tokens so public-site defaults cannot override Pupitre light/dark surfaces and keyboard focus.
- Host styling (M4): `styles.css` points every border at `--border` in the base layer; bare `border` utilities no longer paint Tailwind v4's currentColor (near-black) on cards, tables, chart panels, selects and buttons. Stat cards size to their widget column instead of the viewport, and the table page indicator no longer wraps.
- Accessibility (M4): move the panel toolbar banner outside the main landmark and cover shell landmark best practices.
- Realtime inbox (M4): retain existing notification items and keyboard focus during background ping refreshes.
- Accessibility (WP42): use an opaque auth canvas and strengthen light muted-text contrast so authentication links and muted-surface text meet AA in the built host application.
- Accessibility (WP42): isolate CheckboxList option field scopes and labels; hide duplicate native inputs correctly, preserve required/error descriptions, and provide 24px checkbox targets with visible keyboard focus.
- Accessibility (WP42): fall back to field names for unlabelled Text controls, repair standalone/nested infolist description-list semantics, and remove invalid ARIA from decorative hint/color content.
- Accessibility (WP42): trap and restore mobile navigation/modal/search focus, dismiss menus with Escape, expose skip/landmark structure, uniquely label repeated profile controls and toast dismissal actions, and announce empty search states without invalid empty listbox roles.
- Accessibility (WP42): add roving ToggleGroup focus, separately named Radio options, sortable/mixed-selection table semantics, labelled upload/editor controls, editor loading status, chart data alternatives, valid icon/toggle table cell roles, and AA destructive-text contrast on hover.

## Unreleased (0.3.0-beta, milestone M3)

### Added
- Widgets (WP27): added stats with sparklines, lazy chart rendering, table widgets, custom registry dispatch, deferred placeholders, and polling refresh.
- Testing (WP34): added the optional `@rikology/pupitre-ui/testing` Playwright fixture and reusable `AdminPage`; example E2E specs now import the package fixture.
- Relations (WP28): added the catalog-backed RelationManager component with relation label/badge, readOnly action suppression, and shared DataTable rendering.
- AuthShell (WP32b): shows configured social provider sign-in links on the panel login page.
- Theme (WP33): added top-navigation dropdown groups, persisted collapsed icon rail, responsive content-width shells, density scaling, and per-panel font/stylesheet links.
- Table interaction (WP29b): added optimistic editable cells with rollback/toasts, keyboard and drag reorder controls, deferred filter Apply, polling-aware reloads, SSR-safe persisted column visibility, and responsive grid cards.
- Editors (WP26b): added lazy Markdown writing/sanitized preview and attachment upload, lazy CodeMirror with on-demand language extensions, and client-side crop/rotate/flip for image uploads.
- Action extras (WP32c): notification tray and flash toast action controls, including click-to-mark-read actions.
- Timezone (WP35): date/time controls display field-zone wall time without browser-local parsing, submit local datetimes for server validation, and show a zone hint when it differs from the browser.
- WizardBuilder (WP26a): added typed block editing controls and mounted wizard steps with accessible navigation and 422 error-step recovery.
- SchemaParity (M1–M3): added raw-value text masks, textarea autosizing, accessible scalar/range sliders, hint tooltips/actions, and prefix/suffix action controls.
- Import/export (WP30): added a CSV import dialog with preview, header-to-form mapping, async-job progress, summary counts, and downloadable failed-row CSV.

### Changed
- Testing (WP34): `pupitreTest` takes a `pupitre: { panelPath, basePath?, landingPath?, email?, password? }` fixture option (set it in `playwright.config.ts` `use`); `AdminPage` no longer assumes the example app's tenant, credentials or seed data.
- Confirm fixes (M3): inline blur saves no longer steal focus, refreshed rows clear optimistic cells, and page wizards jump once per validation response without blocking subsequent navigation.
- Table interaction (WP29b): distinguish filter labels from row-specific inline controls for accessible, unambiguous navigation.
- Table data (WP29a): expose the overall table summary as a named region, distinct from group summaries.
- Testing (WP34): scope page field helpers to forms so inline table edit buttons cannot be mistaken for loading form fields.
- Widgets (WP27): `Widget.Table` now delegates to the shared `DataTable` instead of a separate compact renderer.
- Widgets (WP27): render stat colors/icons, support widget spans through all four grid columns, and use the documented widget GET endpoint for polling and filter refresh.
- Widgets (WP27): preserve polled values across parent wrapper rerenders, reconcile only changed widget props, and resolve semantic stat colors through theme classes while retaining raw CSS colors.
- Editors (WP26b): text masks consume literal mask positions correctly, Markdown fields link labels and validation descriptions, and CodeMirror syncs external values with readOnly/disabled semantics.
- Editors (WP26b): reconfigure CodeMirror access state in place so disabled, loading, and read-only toggles retain the view, selection, focus, and undo history.
- Theme (WP33): density uses scoped minimum sizes that preserve checkbox/radio and icon controls; mobile sidebars regain an accessible navigation toggle.
- Table interaction (WP29b): editable cells reset drafts and restore focus, preserve component identity through optimistic updates, and page-window reordering preserves global offsets.
- WizardBuilder (WP26a): render step icons/descriptions, keep Next mounted, and use the valid `aria-current=step` variant.
- Import/export (WP30): import dialogs use Base UI modal focus handling, maintain popup/backdrop stacking, and announce progress/results; image crop dialogs use theme tokens.
- Import/export (WP30): queued imports can be dismissed with Cancel or Escape, abort client polling, and toast that the import continues in the background.
- Widgets (WP27): charts include series legends and distinct default colors.

## Unreleased (0.2.0-beta, milestone M2)

### Added

- `AuthShell`, `TenantSwitcher`, `NotificationTray`, `GlobalSearch` (cmdk, configurable key binding), `UserMenu` (custom items, profile, logout) and `ShellSidebar` (collapsible groups persisted per panel, badges, dark logo); `Shell` composes them.
- `Select` async mode: remote search with paging, selected-label hydration, create-option modal, prefix/suffix actions.
- Panel theme variables (`--primary`, `--radius`, custom vars) are applied to the document root so portaled overlays inherit them.

## Unreleased (0.1.0-beta, milestone M1)

### Added

- Default implementations of every M1 catalog component on Base UI + Tailwind v4: inputs (text, textarea, number, select, checkbox(list), radio, toggle(s), date/time, color, tags, key-value, file upload, lazily loaded Tiptap rich editor), layouts (form, grid, section, fieldset, tabs, group, split, placeholder, html, actions), domain components (`DataTable` with URL-driven sort/search/filters/tabs/pagination, row/bulk actions; `Repeater`), infolist entries and the shell (`Shell`, `Toaster`, `Modal`, `ConfirmDialog`, `NotFound`).
- `live({ onBlur, debounce })` support in text-like inputs, theme CSS variables and dark mode on the document root, favicon, action key bindings for header and bulk actions.
- `styles.css` for hosts (import after Tailwind), `components` registry map, Playwright component tests for every catalog fixture.
