import { test } from '@japa/runner'
import PupitreManager from '../../../src/manager.js'
import { defineResource } from '../../../src/builder/resource.js'
import type { PanelDefinition } from '../../../src/definition/panel.js'
import type { ResourceRuntime } from '../../../src/manager.js'

class PostModel {}

class RevisionModel {
  static $getRelation(name: string) {
    if (name !== 'post') throw new Error(`Unknown relation ${name}`)
    return { type: 'belongsTo', foreignKey: 'postId', boot() {}, relatedModel: () => PostModel }
  }
}

test('nested resources are registered once and retain a parent route prefix', async ({
  assert,
}) => {
  const child = defineResource(RevisionModel).slug('revisions').parent(PostModel, 'post')
  const parent = defineResource(PostModel).slug('posts').nested([child]).toDefinition()
  const childDefinition = child.toDefinition()
  const manager = new PupitreManager({} as never)
  const resources = await (
    manager as unknown as {
      resolveResources(panel: PanelDefinition): Promise<ResourceRuntime[]>
    }
  ).resolveResources({
    path: '/admin',
    resources: [childDefinition, parent],
  } as unknown as PanelDefinition)

  assert.deepEqual(
    resources.map((resource) => resource.slug),
    ['posts', 'revisions']
  )
  assert.equal(resources[1]?.routeSlug, 'posts/:parentId/revisions')
  assert.equal(resources[1]?.parent?.relation, 'post')
  assert.isFunction(resources[1]?.definition.scope)
})
