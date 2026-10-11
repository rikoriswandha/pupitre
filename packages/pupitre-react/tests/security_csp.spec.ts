import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { test } from '@japa/runner'

const exec = promisify(execFile)

test('browser runtime initialization never attempts eval, even during schema construction', async ({
  assert,
}) => {
  // A fresh process and dynamic imports install the CSP trap before module loading.
  const script = `
    const { Window } = await import('happy-dom');
    const window = new Window();
    Object.defineProperty(globalThis, 'window', { value: window });
    Object.defineProperty(globalThis, 'document', { value: window.document });
    Object.defineProperty(globalThis, 'navigator', { value: window.navigator });
    let probes = 0;
    globalThis.Function = class { constructor() { probes++; throw new Error('CSP blocks eval'); } };
    await import('@rikology/pupitre-react');
    const { actionResult } = await import('@rikology/pupitre/catalog');
    const { z } = await import('zod');
    if (!z.config().jitless) throw new Error('Browser Zod must be jitless');
    actionResult.safeParse({});
    if (probes !== 0) throw new Error('CSP Function probes: ' + probes);
    console.log('no-eval');
    window.happyDOM.abort();
  `
  const result = await exec(process.execPath, [
    '--conditions=@rikology/source',
    '--import=@poppinss/ts-exec',
    '--input-type=module',
    '-e',
    script,
  ])
  assert.include(result.stdout, 'no-eval')
})
