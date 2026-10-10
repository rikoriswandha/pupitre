import { Window } from 'happy-dom'

/**
 * React DOM decides at module evaluation whether it runs in a browser (for
 * example whether `input` events drive `onChange`). Register a DOM before any
 * test file imports `react-dom` so every suite sees a browser-like runtime;
 * individual tests still install a fresh window per test. Server-side
 * rendering without a DOM is proven in a separate process (`ssr.spec.ts`).
 */
const window = new Window()
const globals: Record<string, unknown> = {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  Node: window.Node,
}
for (const [key, value] of Object.entries(globals)) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
