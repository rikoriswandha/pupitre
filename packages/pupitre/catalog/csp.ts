import { z } from 'zod'

// Run before catalog schemas are constructed. Even a caught Function probe emits a
// script-src CSP violation; the browser runtime must never attempt JIT compilation.
if ('window' in globalThis) z.config({ jitless: true })
