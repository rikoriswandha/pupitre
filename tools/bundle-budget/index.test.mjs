import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { measure, checkBudgets, graph } from './index.mjs'

const roots = [
  '@tiptap/react/index.js',
  '@codemirror/view/index.js',
  'WidgetChartBody.tsx',
  'marked/index.js',
  'ImageCropper.tsx',
  'pupitre-transmit/client/index.js',
]
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'pupitre-budget-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(join(dir, '.vite'))
  const manifest = {
    'inertia/app.tsx': {
      file: 'app.js',
      imports: ['shared'],
      dynamicImports: ['inertia/pages/pupitre.tsx'],
      css: ['app.css'],
    },
    'shared': { file: 'shared.js', css: ['app.css'] },
    'inertia/pages/pupitre.tsx': { file: 'page.js', imports: ['shared'], dynamicImports: roots },
  }
  for (const [index, key] of roots.entries())
    manifest[key] = { file: `lazy-${index}.js`, imports: ['shared'] }
  for (const chunk of Object.values(manifest))
    await writeFile(join(dir, chunk.file), `export const payload = '${chunk.file.repeat(100)}'`)
  await writeFile(join(dir, 'app.css'), 'body { color: red }')
  const save = () => writeFile(join(dir, '.vite/manifest.json'), JSON.stringify(manifest))
  await save()
  return { dir, manifest, save }
}

test('sums the entry and static imports once; keeps all heavy feature groups lazy', async (t) => {
  const { dir } = await fixture(t)
  const result = await measure(dir)
  assert.deepEqual(result.violations, [])
  assert.equal(result.initial.length, 2)
  assert.equal(result.metrics.initialCSS.raw, Buffer.byteLength('body { color: red }'))
  assert.ok(result.metrics.transmit.gzip > 0)
  const limits = Object.fromEntries(
    Object.entries(result.metrics).map(([name, size]) => [
      name,
      { gzip: size.gzip, brotli: size.brotli },
    ])
  )
  assert.deepEqual(checkBudgets(result.metrics, { limits }), [])
  limits.initialJS.gzip--
  assert.match(checkBudgets(result.metrics, { limits })[0], /initialJS.gzip/)
  delete limits.initialCSS
  assert.ok(
    checkBudgets(result.metrics, { limits }).some((error) =>
      error.includes('missing/invalid budget')
    )
  )
})

test('counts directly imported CSS chunks without counting shared CSS twice', async (t) => {
  const { dir, manifest, save } = await fixture(t)
  manifest.stylesheet = { file: 'app.css' }
  manifest['inertia/app.tsx'].imports.push('stylesheet')
  await save()
  assert.equal(
    (await measure(dir)).metrics.initialCSS.raw,
    Buffer.byteLength('body { color: red }')
  )
})

test('rejects heavy static imports even when only the selected Inertia page imports them', async (t) => {
  const { dir, manifest, save } = await fixture(t)
  manifest['inertia/pages/pupitre.tsx'].imports.push(roots[5])
  await save()
  assert.ok((await measure(dir)).violations.some((error) => /transmit: eager/.test(error)))
  manifest['inertia/app.tsx'].imports.push(roots[0])
  await save()
  assert.ok((await measure(dir)).violations.some((error) => /tiptap: eager/.test(error)))
})

test('rejects missing heavy features and dangling manifest references', async (t) => {
  const { dir, manifest, save } = await fixture(t)
  delete manifest[roots[0]]
  manifest['inertia/pages/pupitre.tsx'].dynamicImports.shift()
  await save()
  assert.ok((await measure(dir)).violations.some((error) => /tiptap: no identifiable/.test(error)))
  assert.throws(() => graph({ entry: { imports: ['missing'] } }, ['entry']), /missing chunk/)
})
