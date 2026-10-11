import { test } from '@japa/runner'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stubsRoot } from '../../../stubs/main.js'
import ts from 'typescript'
import { renderWidgetDefinition, writeWidgetDefinition } from '../../../commands/make_widget.js'

test('make:widget writes a typed stub once and preserves existing files', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-make-widget-'))
  const target = join(root, 'app/admin/widgets/posts_per_month_widget.ts')
  const template = await readFile(join(stubsRoot, 'make/widget.stub'), 'utf8')
  try {
    const output = await writeWidgetDefinition({
      target,
      directory: join(root, 'app/admin/widgets'),
      template,
      name: 'PostsPerMonth',
      type: 'chart',
    })
    assert.isString(output)
    assert.snapshot(output).match()
    assert.isNull(
      await writeWidgetDefinition({
        target,
        directory: join(root, 'app/admin/widgets'),
        template,
        name: 'Different',
        type: 'stats',
      })
    )
    assert.equal(await readFile(target, 'utf8'), output)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test('make:widget table stub imports a model and compiles as a widget definition', async ({
  assert,
}) => {
  const template = await readFile(join(stubsRoot, 'make/widget.stub'), 'utf8')
  const output = renderWidgetDefinition(template, 'PostsWidget', 'table')

  assert.snapshot(output).match()
  assert.include(output, 'import Model from "#models/posts"')
  assert.include(output, "defineWidget('posts', Model)")
  assert.include(output, '.table((table) => table)')
  const compiled = ts.transpileModule(output, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  assert.deepEqual(compiled.diagnostics, [])
})
