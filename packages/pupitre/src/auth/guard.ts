import type { PanelRuntime } from '../manager.js'

/** Resolves the guard shared by panel routing, request context, and auth flows. */
export function panelGuard(panel: Pick<PanelRuntime, 'guard' | 'auth'>): string | undefined {
  return panel.guard ?? (panel.auth.login ? 'web' : undefined)
}
