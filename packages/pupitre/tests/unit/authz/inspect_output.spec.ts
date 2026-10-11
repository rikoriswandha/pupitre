import { test } from '@japa/runner'
import { schema, table } from '../../../index.js'
import type { PanelRuntime, ResourceRuntime } from '../../../src/manager.js'
import { buildPolicyInspection } from '../../../src/inspect/report.js'
import { formatPolicyInspection } from '../../../src/inspect/format.js'
import { closeTestApp, createTestApp, fixturePanel, Post, PostPolicy } from '../../helpers/app.js'

const resource = {
  slug: 'posts',
  model: Post,
  definition: {
    model: 'Post',
    policy: PostPolicy,
    globallySearchable: [],
    pages: { list: {}, create: {}, edit: {}, view: {} },
    table: {
      columns: [
        table.text('title').searchable().definition,
        table.text('slug').searchable().definition,
      ],
    },
    actions: { header: [], row: [], bulk: [] },
    form: [
      schema
        .text('title')
        .live({ server: true })
        .afterStateUpdated(({ get, set }) => set('slug', String(get('title') ?? '').toLowerCase()))
        .toDefinition(),
    ],
  },
} as unknown as ResourceRuntime
const panel = { id: 'admin', resources: [resource] } as unknown as PanelRuntime

test.group('pupitre inspect output', () => {
  test('includes server closure classification in JSON and text output', async ({ assert }) => {
    const [entry] = await buildPolicyInspection([panel])
    assert.equal(entry?.fieldClosures[0]?.field, 'title')
    assert.equal(entry?.fieldClosures[0]?.afterStateUpdated, 'server')
    const json = JSON.parse(JSON.stringify([entry])) as (typeof entry)[]
    assert.equal(json[0]?.fieldClosures[0]?.afterStateUpdated, 'server')
    const text = formatPolicyInspection([entry!])
      .map(({ message }) => message)
      .join('\n')
    assert.include(text, 'Field closures:')
    assert.include(text, 'title: afterStateUpdated=server')
  })

  test('detects SQLite searchable columns with and without indexes', async ({ assert }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: fixturePanel }) },
    })
    try {
      // This module binds Lucid's service at import time; load only after the test app boots.
      const { missingSearchIndexes } = await import('../../../src/inspect/search_indexes.js')
      const withoutIndexes = await missingSearchIndexes(resource, ['title', 'slug'])
      assert.deepEqual(withoutIndexes, ['title', 'slug'])
      const database = await fixture.app.container.make('lucid.db')
      await database.connection().schema.alterTable('posts', (builder) => {
        builder.index(['title'], 'posts_title_search_idx')
      })
      const missing = await missingSearchIndexes(resource, ['title', 'slug'])
      assert.deepEqual(missing, ['slug'])
      const allIndexed = await missingSearchIndexes(resource, ['title'])
      assert.deepEqual(allIndexed, [])
    } finally {
      await closeTestApp(fixture)
    }
  })
})
