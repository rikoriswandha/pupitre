import { test } from '@japa/runner'
import { parseTableParams } from '../../src/query/table_query.js'

test.group('table query prefixes', () => {
  test('reads a nested query namespace', ({ assert }) => {
    const result = parseTableParams(
      { comments: { sort: '-createdAt', filters: { approved: 'true' }, page: '2' } },
      'comments'
    )
    assert.deepEqual(result, {
      sort: '-createdAt',
      filters: { approved: 'true' },
      page: '2',
    })
  })

  test('parses bracket-encoded namespaces including nested filters', ({ assert }) => {
    const result = parseTableParams(
      {
        'comments[sort]': '-createdAt',
        'comments[filters][approved]': 'true',
        'comments[filters][publishedAt][from]': '2026-01-01',
        'other[sort]': 'title',
      },
      'comments'
    )
    assert.deepEqual(result, {
      sort: '-createdAt',
      filters: { approved: 'true', publishedAt: { from: '2026-01-01' } },
    })
  })

  test('leaves unprefixed list queries unchanged', ({ assert }) => {
    const params = { 'sort': '-createdAt', 'filters[approved]': 'true' }
    assert.strictEqual(parseTableParams(params), params)
  })
})
