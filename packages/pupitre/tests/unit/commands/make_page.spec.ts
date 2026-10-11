import { test } from '@japa/runner'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stubsRoot } from '../../../stubs/main.js'
import { writePageDefinition } from '../../../commands/make_page.js'

test('make:page writes its stub once and preserves existing files', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-make-page-'))
  const target = join(root, 'app/admin/pages/settings_page.ts')
  const template = await readFile(join(stubsRoot, 'make/page.stub'), 'utf8')
  try {
    const output = await writePageDefinition({
      target,
      directory: join(root, 'app/admin/pages'),
      template,
      slug: 'settings',
      title: 'Settings',
    })
    assert.isString(output)
    assert.snapshot(output).match()
    assert.isNull(
      await writePageDefinition({
        target,
        directory: join(root, 'app/admin/pages'),
        template,
        slug: 'different',
        title: 'Different',
      })
    )
    assert.equal(await readFile(target, 'utf8'), output)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
