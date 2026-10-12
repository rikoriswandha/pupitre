# Changelog

## Unreleased (1.0.0, milestone M4)

### Added
- Realtime (WP39): optional `Pupitre`/`PupitreShell` client context, SSR-safe `useRealtimeSubscription` with stable callbacks and cleanup, coalesced descriptor-scoped `useTableRealtime`, and notification push refresh with polling fallback.
- Security (WP42): preserve Request-input methods and headers in `jsonFetch`, ensuring XSRF headers on all mutating methods; add multipart/upload/deletion regressions.

### Changed
- Navigation guard (M4): `useNavigationGuard(shouldBlock)` no longer calls `window.confirm`. It returns `{ pending, proceed, cancel }` and holds the blocked Inertia visit, so the caller can render its own confirmation; `proceed()` re-issues the visit with its original options. Prefetch visits are no longer blocked. Tab close/reload still use the browser's native prompt.

### Fixed
- Options: abort superseded searches during debounce and discard late responses without changing options, paging, loading, or errors.

## Unreleased (0.3.0-beta, milestone M3)

### Added
- Widgets (WP27): added polling-driven partial reloads for widget props and widget grid rendering integration.
- Relations (WP28): `useTable` reads descriptor-selected top-level data props and namespaces table query keys while preserving list-page `data` behavior.
- Action extras (WP32c): modal deep-link URL synchronization and initial query-param opening, modal footer action execution with form data, and global shortcuts for non-row actions.
- Server evaluation (WP31): wired debounced `evaluate` actions to `/_pupitre/evaluate`, ignored stale responses, and applied only safe `/data/**` state updates.
- WizardBuilder (WP26a): action modals navigate wizard steps, submit on the final step, select the first errored step after a 422, and retain Next/Back navigation alongside footer actions when modal submit is disabled.
- Import/export (WP30): direct CSV downloads and jobs-backed export/import polling now flow through the action bridge, with progress/completion toasts and file delivery.

### Changed
- Confirm fixes (M3): share Cmd/Ctrl shortcut matching across page and UI actions, include field affix/hint shortcuts, and suppress export cancellation errors on navigation.
- Widgets (WP27): resolve and submit resource forms nested beneath widget layouts, without selecting disconnected forms.
- Widgets (WP27): widget tables can render outside the spec runtime while retaining `useTable` URL-prefix sorting, pagination, and prop-only reloads.
- Action extras (WP32c): import actions now stop before form submission and page-level shortcuts dispatch once; footer confirmations gate requests.
- WizardBuilder (WP26a): 422 errors select the first invalid step once per submit, without pinning navigation to stale errors.

## Unreleased (0.2.0-beta, milestone M2)

### Added

- `kind: 'auth'` pages render inside the registry `AuthShell`; `kind: 'custom'` pages and host pages can keep the panel shell through `PupitreShell`.
- `ShellProps` gains `tenant`, `tenants` and `notifications`; `ShellRegistry` gains `AuthShell`.
- Hooks: `useOptions` (debounced, abortable, paged dynamic select options), `useNotificationsPolling` (pauses while the tab is hidden); shared `jsonFetch`/`xsrfToken` bridge helpers.

## Unreleased (0.1.0-beta, milestone M1)

### Added

- `Pupitre` Inertia page, `PupitreRenderer` (store reset only on `page.key` change; reloads refresh `/errors`, `/meta/record`, `/options`), `SpecRenderer` for nested specs, `defineRegistry` (catalog + shell components, built-in `$computed` functions, `$raw` directive).
- Inertia bridge: form submission with 422 → `/errors/**`, action protocol (link/direct/confirm/form) over JSON `fetch` with `X-Pupitre-Action`, `X-Pupitre-Url`, XSRF header and descriptor HTTP method, `ActionResult` handling (flash, redirect, reload, patch, deselect), uploads, toasts surviving redirects, catalog-version mismatch reload guard.
- Hooks: `useBoundValue`, `useFieldError`, `useStateValue`, `useSetState`, `usePanel`, `usePage`, `useRunAction`, `useTable` (URL-driven table state with partial visits), `useSubmitForm`, `useEmbedded`, `useUpload`, `useToast`, `useVisit`, `useNavigationGuard`; test seams `setRouter`, `setFetch`.
