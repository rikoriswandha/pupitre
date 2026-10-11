import { test } from '@japa/runner'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stubsRoot } from '../../../stubs/main.js'
import { writePanelDefinition } from '../../../commands/make_panel.js'

test('make:panel writes the stub once and preserves existing files', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-make-panel-'))
  const target = join(root, 'app/admin/panels/app.ts')
  const template = await readFile(join(stubsRoot, 'app/admin/panels/panel.stub'), 'utf8')
  try {
    const output = await writePanelDefinition({
      target,
      directory: join(root, 'app/admin/panels'),
      template,
      name: 'app',
      path: '/app',
      guard: 'web',
    })
    assert.isString(output)
    assert.snapshot(output).match()
    assert.isNull(
      await writePanelDefinition({
        target,
        directory: join(root, 'app/admin/panels'),
        template,
        name: 'app',
        path: '/different',
        guard: 'other',
      })
    )
    assert.equal(await readFile(target, 'utf8'), output)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
