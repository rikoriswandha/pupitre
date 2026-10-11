import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/core/factories/app'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { configure } from '../configure.js'
import { getMetaData, getCommand } from '../commands/main.js'

test('configure publishes configurable migration once and registers a lazy sync command', async ({
  assert,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-shield-configure-'))
  const app = new AppFactory().create(new URL(`file://${root}/`))
  await app.init()
  try {
    const rendered: { contents: string; destination: string }[] = []
    const commands: string[] = []
    const command = {
      app,
      parsedFlags: { 'user-table': 'accounts' },
      createCodemods: async () => ({
        makeUsingStub: async (source: string, path: string, data: object) => {
          const stubs = await app.stubs.create()
          const stub = await stubs.build(path, { source })
          const result = await stub.prepare(data)
          rendered.push(result)
          await mkdir(join(root, 'database/migrations'), { recursive: true })
          await writeFile(result.destination, result.contents)
        },
        updateRcFile: async (callback: (rcFile: { addCommand(name: string): void }) => void) => {
          callback({ addCommand: (name) => commands.push(name) })
        },
      }),
    }
    // The minimal codemod recording harness implements only the methods this hook uses.
    await configure(command as never)
    await configure(command as never)
    assert.lengthOf(rendered, 1)
    assert.match(rendered[0].destination, /\/\d{13}_create_pupitre_shield_tables\.ts$/)
    assert.include(rendered[0].contents, "inTable('accounts')")
    assert.notInclude(rendered[0].contents, 'await this.schema')
    assert.sameMembers(commands, [
      '@rikology/pupitre-shield/commands',
      '@rikology/pupitre-shield/commands',
    ])
    const metadata = await getMetaData()
    assert.equal(metadata[0].commandName, 'shield:sync')
    const loaded = await getCommand(metadata[0])
    assert.equal(loaded?.commandName, 'shield:sync')
  } finally {
    await app.terminate()
    await rm(root, { recursive: true, force: true })
  }
})
