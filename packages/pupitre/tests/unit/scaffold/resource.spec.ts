import { test } from '@japa/runner'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import FixtureModel from '../../fixtures/scaffold/model.js'
import fixtureMigration from '../../fixtures/scaffold/migration.js'
import {
  applyDeclaredTypes,
  introspectModel,
  parseMigration,
} from '../../../src/scaffold/introspect.js'
import MakeResourceCommand from '../../../commands/make_resource.js'
import { renderResource } from '../../../src/scaffold/render.js'

const model = FixtureModel as unknown as Parameters<typeof introspectModel>[0]
const modelDetails = introspectModel(model)
const modelFieldsPromise = applyDeclaredTypes(modelDetails.fields, [
  fileURLToPath(new URL('../../fixtures/scaffold/model.ts', import.meta.url)),
])
const migrationFields = parseMigration(fixtureMigration, 'scaffold_fixtures').map((field) => ({
  name: field.name.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
  type: field.type as (typeof modelDetails.fields)[number]['type'],
  primary: field.name === 'id',
  enum: field.enum,
}))
const scaffoldInput = {
  modelName: 'Fixture',
  modelImport: '#models/fixture',
  belongsTo: modelDetails.belongsTo,
}

test.group('make:resource scaffold', () => {
  test('reports relations that cannot be scaffolded yet', ({ assert }) => {
    assert.deepEqual(modelDetails.skippedRelations, ['comments'])
  })
  test('reads foreign keys and enum/check constraints from migrations', ({ assert }) => {
    const columns = parseMigration(fixtureMigration, 'scaffold_fixtures')
    assert.equal(columns.find((column) => column.name === 'author_id')?.foreignTable, 'users')
    assert.deepEqual(columns.find((column) => column.name === 'state')?.enum, [
      'draft',
      'published',
    ])
    assert.deepEqual(columns.find((column) => column.name === 'visibility')?.enum, [
      'private',
      'public',
    ])
  })
  test('renders a resource from model introspection metadata', async ({ assert }) => {
    assert.snapshot(renderResource({ ...scaffoldInput, fields: await modelFieldsPromise })).match()
  })

  test('renders a resource from migration column definitions', ({ assert }) => {
    assert.snapshot(renderResource({ ...scaffoldInput, fields: migrationFields })).match()
  })

  test('command writes a resource, skips an existing file, and overwrites with force', async ({
    assert,
  }) => {
    const directory = await mkdtemp(join(tmpdir(), 'pupitre-resource-'))
    const migrationPath = fileURLToPath(new URL('../../fixtures/scaffold', import.meta.url))
    const modelPath = fileURLToPath(new URL('../../fixtures/scaffold/model.ts', import.meta.url))
    const app = {
      import: async () => ({ default: FixtureModel }),
      makePath: (...parts: string[]) => join(directory, ...parts),
      modelsPath: () => modelPath,
      migrationsPath: () => migrationPath,
    }
    const messages: string[] = []
    const logger = {
      error: (value: string) => messages.push(`error: ${value}`),
      info: (value: string) => messages.push(`info: ${value}`),
      success: (value: string) => messages.push(`success: ${value}`),
      warning: (value: string) => messages.push(`warning: ${value}`),
    }
    const runCommand = async (force: boolean) => {
      const command = Object.create(MakeResourceCommand.prototype)
      Object.defineProperties(command, {
        name: { value: 'Fixture' },
        model: { value: '#models/fixture' },
        fromMigration: { value: true },
        force: { value: force },
        app: { value: app },
        logger: { value: logger },
      })
      await (command as MakeResourceCommand).run()
    }
    const path = join(directory, 'app/admin/resources/fixture_resource.ts')
    try {
      await runCommand(false)
      assert.isTrue(messages.some((message) => message.includes('Created resource')))
      assert.isTrue(
        messages.some((message) => message.includes('Skipped unsupported relations: comments'))
      )
      const first = await readFile(path, 'utf8')
      assert.include(first, "schema.select('authorId').relationship('author', 'name')")
      await runCommand(false)
      assert.equal(await readFile(path, 'utf8'), first)
      await runCommand(true)
      assert.equal(await readFile(path, 'utf8'), first)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
