import { fileURLToPath } from 'node:url'

/**
 * Absolute path to the directory holding the package stubs. Used by
 * `configure.ts` and the generator commands.
 */
export const stubsRoot = fileURLToPath(new URL('./', import.meta.url))
