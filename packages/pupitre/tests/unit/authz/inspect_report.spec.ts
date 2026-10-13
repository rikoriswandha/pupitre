import { test } from '@japa/runner'
import { action } from '../../../index.js'
import { buildPolicyInspection } from '../../../src/inspect/report.js'
import type { PanelRuntime, ResourceRuntime } from '../../../src/manager.js'

class FixturePolicy {
  viewAny() {}
  create() {}
  update() {}
  view() {}
  delete() {}
}

function panel(policy: unknown, actions: unknown[] = []) {
  const resource = {
    slug: 'posts',
    definition: {
      model: 'Post',
      policy,
      globallySearchable: ['title'],
      pages: { list: {}, create: {}, edit: {}, view: {} },
      table: {
        columns: [
          { name: 'slug', searchable: true },
          { name: 'title', searchable: true },
        ],
      },
      actions: { header: [], row: actions, bulk: [] },
    },
  } as unknown as ResourceRuntime
  return { id: 'admin', resources: [resource], pages: [], widgets: [] } as unknown as PanelRuntime
}

test.group('pupitre inspect policy report', () => {
  test('reports required abilities missing from a policy', async ({ assert }) => {
    const [entry] = await buildPolicyInspection([
      panel(FixturePolicy, [action('publish').can('publish').definition]),
    ])
    assert.deepEqual(entry?.requiredAbilities, [
      'create',
      'delete',
      'publish',
      'update',
      'view',
      'viewAny',
    ])
    assert.deepEqual(entry?.searchableColumns, ['slug', 'title'])
    assert.deepEqual(entry?.missingAbilities, ['publish'])
    assert.isFalse(entry?.allowByDefault)
  })

  test('marks absent policies as allow-by-default', async ({ assert }) => {
    const [entry] = await buildPolicyInspection([panel(undefined)])
    assert.isTrue(entry?.allowByDefault)
    assert.isNull(entry?.policy)
    assert.deepEqual(entry?.missingAbilities, [])
    assert.deepEqual(entry?.searchableColumns, ['slug', 'title'])
  })
})
