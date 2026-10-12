# Changelog

## Unreleased (1.0.0, milestone M4)

### Changed
- Redesign (M4): new default "writing desk" skin. Warm OKLCH neutrals (canvas, sidebar, card layers), blotter-green default primary, semantic `success`/`warning`/`danger`/`info` tokens with derived `-soft`/`-ink` variants (mixed in oklab so a `theme.primary` override re-skins every state), `--input-strong` for checkbox/radio/switch boundaries, chart palette, elevation and density (`--control-h`, `--row-py`) tokens. See the root `DESIGN.md`.
- Primitives (M4): `Button` now takes `variant` (`solid`/`outline`/`ghost`/`link`) × `color` (`primary`/`gray`/`success`/`warning`/`danger`/`info`) × `size` (`xs`–`lg`) plus `square` and `loading`; the old `default`/`secondary`/`outline`/`destructive` variants are removed. New exports: `buttonClasses`, `controlClasses`, `Textarea`, `InputGroup`/`InputAddon`/`InputSlot`, `FieldDescription`, `RequiredMark`, `CheckboxControl`, `SwitchControl`, `Avatar`, `Kbd`, `Spinner`, `Skeleton`, `Tooltip`, `Panel`/`PanelHeader`, `EmptyState`, `toTone`, and popup/dialog/tab class helpers.
- Shell (M4): sticky topbar (search field, notifications, avatar menu), breadcrumbs above the page title, raised active navigation items, icon-rail tooltips, tenant switcher card, mobile drawer, and header actions laid out by the new `ActionList` (leading action promoted to primary, overflow in a "More actions" menu).
- Components (M4): every catalog component restyled: tables in a single panel with toolbar search, filter/column popovers, bulk-action menu and row actions collapsed after two; form sections, tabs and wizards as panels (nested panels flatten through `PanelNestingContext`); selects and pickers open popups; infolists, widgets, modals, toasts, auth and profile screens follow the same system in light and dark.
- Testing (M4): `AdminPage.openAction(name, row)` opens a row's "More actions" menu when the action is not inline.
- Motion (M4): shared easing tokens (`ease-ui`, `ease-move`, `ease-drawer`) replace ad hoc curves. The desktop sidebar rail toggle morphs via the View Transitions API (sidebar crossfades and resizes, content slides; instant under reduced motion or without browser support). Section, Repeater item, Builder block and sidebar nav group bodies open and close with a height and fade transition through the new `Collapse` primitive, with rotating chevrons. Toasts grow in from the bottom edge and close their slot on dismissal instead of disappearing. Top-navigation group dropdowns and the bulk-selection toolbar fade in, and buttons give subtle press feedback.

### Added
- Registry (WP40): deterministic shadcn registry generated from UI sources, versioned npm/import-graph dependencies, preserved relative targets, public `/r/*.json` payloads and index, CI drift check, and copy-ability tests.
- Audit (WP38): `Widget.Timeline` catalog renderer and exported `WidgetTimeline` display server-formatted activity times, actors, icons/colors, structured field changes, and empty states; `WidgetGrid` supports timeline spans and deferred data.
- Realtime (WP39): DataTable and NotificationTray replace polling with configured channel subscriptions, retain polling fallback, and clean up subscriptions and pending reloads on unmount.
- Realtime inbox (WP39): open notification trays refresh items on user-channel pings through the existing single subscription; superseded requests are aborted and late responses cannot overwrite the current inbox.
- Accessibility (WP42): strict WCAG 2.1 A/AA axe coverage across registry fixtures, shell/account components, dialogs and interactive popup/editor/table states, plus an example auth/CRUD/settings/security audit.

### Fixed
- Class merging (M4): `cn()` now resolves conflicting utilities with `tailwind-merge`, so a component's `className` reliably overrides primitive defaults instead of depending on CSS order. Template-literal class concatenations with conflicts now go through `cn()`.
- Selects (M4): table filters, grouping, rows-per-page, editable cells, widget filters and import mapping use the new `SelectMenu` primitive, the same Base UI trigger and listbox as form `Select`, instead of native `<select>` elements. Their heights follow density (`--control-h`, `--control-h-sm`), and auto-width triggers size to their widest option like a native select, so a column of editable cells lines up. `.pupitre-native-select` remains for `Select native`, drawing the `chevrons-up-down` icon instead of the UA arrow.
- Color (M4): the swatch fills its slot instead of collapsing to a sliver; presets are 28px square buttons.
- Switch (M4): the thumb keeps an even 2px inset in both states instead of overrunning the track when checked, and stays light in dark mode (new `--switch-thumb` token) instead of reading as a hole in the track.
- Tags and multi-select (M4): chips and the draft input are centered and compact, so a single row matches the control height.
- Checkbox layout: keep compact 16px checkbox visuals within 24px form hit targets, align option labels, and separate CheckboxList legends from options. Label clicks, target-edge clicks, and keyboard toggling remain supported.
- ConfirmDialog: narrower (`sm`) dialog with the heading centred on the tone icon and full-size description text.
- Confirmations (M4): the Form `dirtyGuard` prompt ("Discard unsaved changes?", Stay / Leave page) now renders the registry `ConfirmDialog`, the same dialog as action confirmations such as Delete, instead of `window.confirm`; passkey deletion in `ProfileSecurity` uses `ConfirmDialog` too. Closing or reloading the tab still shows the browser's native prompt.
- DataTable (M4): an absent data prop no longer re-renders forever (stable empty rows, manual pagination).
- Wizard (M4): advancing to the last step no longer submits the form when Next becomes the submit button.
- Repeater/Builder (M4): render their field label, hint, helper text and required marker.
- Host styling (M4): namespace the example's card/focus tokens so public-site defaults cannot override Pupitre light/dark surfaces and keyboard focus.
- Host styling (M4): `styles.css` points every border at `--border` in the base layer; bare `border` utilities no longer paint Tailwind v4's currentColor (near-black) on cards, tables, chart panels, selects and buttons. Stat cards size to their widget column instead of the viewport, and the table page indicator no longer wraps.
- Navigation (M4): sidebar, brand, breadcrumb, record sub-navigation and table record links navigate through the Inertia router (new `NavLink` primitive) instead of reloading the document; modified clicks, new-tab targets, downloads, fragments and cross-origin URLs keep native behavior.
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
