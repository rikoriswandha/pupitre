import { test } from '@japa/runner'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { stubsRoot } from '../../../stubs/main.js'
import { writeRelationManagerDefinition } from '../../../commands/make_relation_manager.js'

test('make:relation-manager writes its stub once and preserves existing files', async ({
  assert,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-make-relation-manager-'))
  const target = join(root, 'comments_relation_manager.ts')
  const template = await readFile(join(stubsRoot, 'make/relation-manager.stub'), 'utf8')
  const options = {
    target,
    directory: root,
    template,
    parent: 'Post',
    modelImport: '#models/post',
    relation: 'comments',
    label: 'comments',
  }
  try {
    const output = await writeRelationManagerDefinition(options)
    if (output === null) throw new Error('Expected the relation manager file to be created')
    assert.include(output, 'defineRelationManager(Post, "comments")')
    assert.isNull(await writeRelationManagerDefinition(options))
    assert.equal(await readFile(target, 'utf8'), output)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
