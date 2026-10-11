# Changelog

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
