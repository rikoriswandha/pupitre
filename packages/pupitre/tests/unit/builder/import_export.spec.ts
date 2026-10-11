import { test } from '@japa/runner'
import { actions, exportColumn } from '../../../index.js'

test.group('ImportExport action builders', () => {
  test('builds immutable export columns with labels and state formatters', ({ assert }) => {
    const formatter = (value: unknown) => String(value ?? '').toUpperCase()
    const base = exportColumn('title')
    const column = base.label('Post title').formatStateUsing(formatter)
    const exportAction = actions.export().columns([column])

    assert.deepEqual(exportAction.definition.exportColumns, [
      { name: 'title', label: 'Post title', formatStateUsing: formatter },
    ])
    assert.isUndefined(base.definition.label)
    assert.equal(actions.export().definition.exportColumns, undefined)
  })

  test('supports import record resolution and async bulk action declaration', ({ assert }) => {
    const resolveRecord = async ({ data }: { data: Record<string, unknown> }) =>
      data.slug === 'known' ? null : null
    const importer = actions.import().resolveRecord(resolveRecord)
    const bulk = actions.bulk('publish-selected').async()

    assert.equal(importer.definition.builtin, 'import')
    assert.equal(importer.definition.resolveRecord, resolveRecord)
    assert.equal(bulk.definition.context, 'bulk')
    assert.isTrue(bulk.definition.async)
  })
})
