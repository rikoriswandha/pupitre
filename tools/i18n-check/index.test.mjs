import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractKeys, checkKeys, check, packages } from './index.mjs'

test('extracts TSX literals and imported aliases without reading comments or builder methods', () => {
  const result = extractKeys(
    `
    import { t as translate } from '@rikology/pupitre-react'
    // t('Comment')
    const text: string = "t('Not a call')"
    const view = <button aria-label={t('Delete {label}?', { label: text })}>{translate('Save')}</button>
    table.text('title'); object.t('Method')
  `,
    'component.tsx'
  )
  assert.deepEqual(result.errors, [])
  assert.deepEqual(
    result.keys.map(({ key }) => key),
    ['Delete {label}?', 'Save']
  )
})

test('rejects dynamic, concatenated, template and absent keys with source locations', () => {
  const result = extractKeys(
    "t(key); t('Delete ' + label); t(`Save`); t(`Delete ${label}`); t()",
    'dynamic.ts'
  )
  assert.equal(result.errors.length, 5)
  assert.ok(result.errors.every((error) => error.startsWith('dynamic.ts:1:')))
  assert.deepEqual(result.keys, [])
})

test('requires own, nonempty translations and complete plural messages', () => {
  const result = extractKeys("t('Save'); t('Count'); t('toString'); t('Empty'); t('Broken')")
  assert.equal(
    checkKeys(result, {
      Save: 'Simpan',
      Count: { one: 'Satu', other: '{count}', zero: 'Kosong' },
      Empty: '',
      Broken: { one: 'Satu' },
    }).length,
    3
  )
  assert.deepEqual(
    checkKeys(extractKeys("t('Count')"), { Count: { one: 'Satu', other: 'Banyak' } }),
    []
  )
})

test('fails on malformed source rather than silently skipping it', () => {
  assert.ok(extractKeys("const view = <button>{t('Save')}</button", 'broken.tsx').errors.length > 0)
})

test('scans real source roots, excludes artifacts and enforces client dictionaries', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'pupitre-i18n-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  await writeFile(join(directory, 'package.json'), '{"type":"module"}')
  for (const name of packages) {
    if (name === 'pupitre-audit' || name === 'pupitre-transmit') {
      const source = join(directory, 'packages', name)
      await mkdir(source, { recursive: true })
      await writeFile(join(source, 'index.ts'), `t('${name}')`)
      continue
    }
    const source = join(directory, 'packages', name, 'src')
    await mkdir(join(source, 'nested'), { recursive: true })
    await writeFile(join(source, 'nested', 'message.ts'), `t('${name}')`)
  }
  const catalog = join(directory, 'packages/pupitre/src/locales')
  await mkdir(catalog)
  await writeFile(
    join(catalog, 'id.ts'),
    `export default ${JSON.stringify(Object.fromEntries(packages.map((name) => [name, 'Terjemahan'])))}`
  )
  await writeFile(join(catalog, 'client_keys.ts'), `export default ${JSON.stringify(packages)}`)
  await writeFile(
    join(directory, 'packages/pupitre-ui/src/nested/missing.tsx'),
    "const view = <span>{t('Missing')}</span>; t(variable)"
  )
  for (const excluded of [
    'tests',
    'build',
    'dist',
    'node_modules',
    'stubs',
    'playwright/.cache',
    '.cache',
  ]) {
    const target = join(directory, 'packages/pupitre-ui', excluded)
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'ignored.js'), 't(notLiteral)')
  }
  const client = join(directory, 'packages/pupitre-transmit/client')
  await mkdir(client)
  await writeFile(join(client, 'index.ts'), `t('Transport client')`)
  const result = await check(directory)
  assert.equal(result.keyCount, packages.length + 2)
  assert.equal(result.errors.length, 4)
  assert.ok(
    result.errors.some((error) => error.includes('missing Indonesian translation for "Missing"'))
  )
  assert.ok(result.errors.some((error) => error.includes('requires an English string literal')))
  assert.ok(
    result.errors.some((error) => error.includes('missing client dictionary key \"Missing\"'))
  )
  assert.ok(
    result.errors.some((error) =>
      error.includes('missing Indonesian translation for \"Transport client\"')
    )
  )
})
