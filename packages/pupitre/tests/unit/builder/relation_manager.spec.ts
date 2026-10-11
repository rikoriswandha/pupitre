import { test } from '@japa/runner'
import { defineRelationManager, relationGroup } from '../../../src/builder/relation_manager.js'
import { defineResource } from '../../../src/builder/resource.js'
import { flattenRelationManagers } from '../../../src/definition/relation_manager.js'
import type { LucidModel } from '@adonisjs/lucid/types/model'

class PostModel {}

const model = PostModel as unknown as LucidModel

test.group('relation manager builder', () => {
  test('builds immutable relation descriptors and supports groups on resources', ({ assert }) => {
    const comments = defineRelationManager(model, 'comments')
      .label('Comments')
      .icon('message-square')
      .readOnly()
    const editable = comments.readOnly(false)
    const group = relationGroup('Content', [editable])
    const resource = defineResource(PostModel as never)
      .relations([group])
      .toDefinition()

    assert.equal(comments.toDefinition().label, 'Comments')
    assert.isTrue(comments.toDefinition().readOnly)
    assert.isFalse(editable.toDefinition().readOnly)
    const first = resource.relations?.[0]
    assert.isTrue(Boolean(first && 'kind' in first && first.kind === 'relationGroup'))
    assert.equal(flattenRelationManagers(resource.relations)[0]?.group, 'Content')
  })
})
