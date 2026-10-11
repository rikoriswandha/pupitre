import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const content = new URL('../src/content/docs/', import.meta.url)

test('generated API reference omits implementation-only exports', async () => {
  await import('./prepare-content.mjs')
  const panel = await readFile(new URL('reference/api-panel.md', content), 'utf8')
  const configuration = await readFile(new URL('reference/api-configuration.md', content), 'utf8')
  assert.doesNotMatch(panel, /\bpanelBuilder\b/)
  assert.doesNotMatch(configuration, /\bresolveConfig\b/)
  assert.match(panel, /\bdefinePanel\b/)
  assert.match(configuration, /\bdefineConfig\b/)
})

test('customization guide names an existing registry hook', async () => {
  const guide = await readFile(new URL('customizing-ui.md', content), 'utf8')
  const registry = JSON.parse(await readFile(new URL('../../../packages/pupitre-ui/registry/public/registry.json', import.meta.url), 'utf8'))
  assert.doesNotMatch(guide, /\buse-form\b/)
  assert.match(guide, /pupitre:ui add use-live-field/)
  assert.ok(registry.items.some((item) => item.name === 'use-live-field'))
})
