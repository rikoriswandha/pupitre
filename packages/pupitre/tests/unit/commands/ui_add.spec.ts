import { test } from '@japa/runner'
import { EventEmitter } from 'node:events'
import type { spawn } from 'node:child_process'
import { addUiComponents } from '../../../commands/ui_add.js'

function installer(code = 0) {
  const calls: unknown[][] = []
  const mockedSpawn = ((...arguments_: unknown[]) => {
    calls.push(arguments_)
    const child = new EventEmitter()
    queueMicrotask(() => child.emit('close', code, null))
    return child
  }) as unknown as typeof spawn
  const mockedFetch = (async () =>
    new Response(JSON.stringify({ items: [{ name: 'select' }, { name: 'text' }] }))) as typeof fetch
  return { calls, services: { spawn: mockedSpawn, fetch: mockedFetch } }
}

test('pupitre:ui validates names and preserves registry targets without --path', async ({
  assert,
}) => {
  const { calls, services } = installer()
  await addUiComponents(
    ['select', 'text', 'select'],
    { registry: 'http://localhost:3404', yes: true },
    services
  )
  assert.deepEqual(calls, [
    [
      'npx',
      [
        'shadcn@4',
        'add',
        'http://localhost:3404/r/select.json',
        'http://localhost:3404/r/text.json',
        '--yes',
      ],
      { stdio: 'inherit', shell: false },
    ],
  ])
})
test('pupitre:ui rejects unknown names before spawning', async ({ assert }) => {
  const { calls, services } = installer()
  await assert.rejects(
    () => addUiComponents(['../evil'], {}, services),
    /Unknown Pupitre component/
  )
  assert.lengthOf(calls, 0)
})
test('pupitre:ui surfaces installer failure', async ({ assert }) => {
  const { services } = installer(7)
  await assert.rejects(() => addUiComponents(['select'], {}, services), /code 7/)
})
test('pupitre:ui dry run validates without spawning', async ({ assert }) => {
  const { calls, services } = installer()
  assert.deepEqual(await addUiComponents(['select'], { dryRun: true }, services), [
    'shadcn@4',
    'add',
    'https://pupitre.dev/r/select.json',
  ])
  assert.lengthOf(calls, 0)
})

test('pupitre:ui rejects unsafe registry URLs and names before network or spawn', async ({
  assert,
}) => {
  const { calls, services } = installer()
  let fetched = false
  services.fetch = (async () => {
    fetched = true
    throw new Error('Unexpected fetch')
  }) as typeof fetch
  for (const registry of [
    'http://evil.example',
    'https://user:pass@pupitre.dev',
    'https://pupitre.dev?token=secret',
    'https://pupitre.dev#fragment',
    'file://remote/share',
    'javascript:alert(1)',
  ])
    await assert.rejects(() => addUiComponents(['select'], { registry }, services))
  for (const name of ['select;touch /tmp/pwned', '--yes', '../select', 'select$(id)'])
    await assert.rejects(() => addUiComponents([name], {}, services))
  assert.isFalse(fetched)
  assert.lengthOf(calls, 0)
})

test('pupitre:ui accepts kebab-case hook registry names', async ({ assert }) => {
  const { services } = installer()
  services.fetch = (async () =>
    new Response(JSON.stringify({ items: [{ name: 'use-mobile' }] }))) as typeof fetch
  const installerArgs = await addUiComponents(['use-mobile'], { dryRun: true }, services)
  assert.include(installerArgs, 'https://pupitre.dev/r/use-mobile.json')
  assert.notInclude(installerArgs, '--path')
})
