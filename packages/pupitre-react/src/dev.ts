/**
 * True only in development builds of the host app. The expression must stay
 * textually `import.meta.env?.DEV` in the emitted JS so Vite statically
 * replaces it (with `false` in production bundles). `ImportMeta.env` is typed
 * by the host's `vite/client` types, which this package does not depend on, so
 * the type is asserted locally instead of augmenting the global `ImportMeta`
 * (a global augmentation conflicts with Vite's declaration in host apps).
 */
export const isDev =
  (import.meta as ImportMeta & { readonly env?: { readonly DEV?: boolean } }).env?.DEV === true
