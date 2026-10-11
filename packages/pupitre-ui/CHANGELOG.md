# Changelog

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
