import { test } from '@japa/runner'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const packageRoot = fileURLToPath(new URL('../', import.meta.url))

test('the runtime imports and server-renders in a Node process without DOM globals', async ({
  assert,
}) => {
  const script = `
    import { createElement } from 'react'
    import { renderToString } from 'react-dom/server'
    if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present')
    const runtime = await import('./src/index.ts')
    renderToString(createElement(runtime.Pupitre, { registry: {} }))
    console.log('ssr-ok')
  `
  const { stdout } = await exec(
    process.execPath,
    [
      '--conditions=@rikology/source',
      '--import=@poppinss/ts-exec',
      '--input-type=module',
      '-e',
      script,
    ],
    { cwd: packageRoot }
  )
  assert.include(stdout, 'ssr-ok')
}).timeout(30_000)
