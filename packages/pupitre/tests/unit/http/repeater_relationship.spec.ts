import { test } from '@japa/runner'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ResourceRuntime } from '../../../src/manager.js'
import { schema } from '../../../src/builder/schema/schema.js'
import { E_PUPITRE_FORBIDDEN } from '../../../src/errors.js'
import { syncRelationshipRepeaters } from '../../../src/http/repeater_relationships.js'

function createFixture() {
  type Row = { id: number; label: string; sort: number; deleted: boolean }
  const rows: Row[] = [{ id: 1, label: 'original', sort: 0, deleted: false }]
  const usedTransactions: unknown[] = []
  const makeLucidRow = (row: Row): LucidRow => {
    const instance = {
      $getAttribute: (key: string) => row[key as keyof Row],
      useTransaction(trx: unknown) {
        usedTransactions.push(trx)
        return instance
      },
      merge(attributes: Record<string, unknown>) {
        Object.assign(row, attributes)
        return instance
      },
      async save() {
        return instance
      },
      async delete() {
        row.deleted = true
        return undefined
      },
    }
    return instance as unknown as LucidRow
  }
  const client = {
    async query() {
      return rows.filter((row) => !row.deleted).map(makeLucidRow)
    },
    async create(attributes: Record<string, unknown>) {
      const row = {
        id: Math.max(0, ...rows.map((item) => item.id)) + 1,
        label: String(attributes.label ?? ''),
        sort: Number(attributes.sort ?? 0),
        deleted: false,
      }
      rows.push(row)
      return makeLucidRow(row)
    },
  }
  const relation = {
    type: 'hasMany',
    relatedModel: () => ({ primaryKey: 'id' }),
  }
  const model = { $getRelation: () => relation } as unknown as LucidModel
  const parent = {
    useTransaction(trx: unknown) {
      usedTransactions.push(trx)
    },
    related() {
      return client
    },
  } as unknown as LucidRow
  const field = schema
    .repeater('links')
    .schema([schema.text('label').required()])
    .relationship('links', { orderColumn: 'sort' })
    .toDefinition()
  const target = { model, definition: { form: [field] } } as unknown as ResourceRuntime
  return { rows, target, client, usedTransactions, parent }
}

test.group('Repeater hasMany synchronization', () => {
  test('adds, updates, removes and orders only children of the parent', async ({ assert }) => {
    const fixture = createFixture()
    const trx = {} as TransactionClientContract
    const parent = fixture.parent
    await syncRelationshipRepeaters(
      fixture.target,
      parent,
      { links: [{ _relationKey: 1, label: 'updated' }, { label: 'created' }] },
      trx
    )
    assert.deepEqual(
      fixture.rows
        .filter((row) => !row.deleted)
        .map(({ id, label, sort }) => ({ id, label, sort })),
      [
        { id: 1, label: 'updated', sort: 0 },
        { id: 2, label: 'created', sort: 1 },
      ]
    )

    await syncRelationshipRepeaters(
      fixture.target,
      parent,
      { links: [{ _relationKey: 2, label: 'kept' }] },
      trx
    )
    assert.deepEqual(
      fixture.rows
        .filter((row) => !row.deleted)
        .map(({ id, label, sort }) => ({ id, label, sort })),
      [{ id: 2, label: 'kept', sort: 0 }]
    )
    assert.isAbove(fixture.usedTransactions.length, 0)
  })

  test('rejects a submitted primary key not owned by the parent', async ({ assert }) => {
    const fixture = createFixture()
    let caught: unknown
    try {
      await syncRelationshipRepeaters(
        fixture.target,
        fixture.parent,
        { links: [{ _relationKey: 999, label: 'foreign' }] },
        {} as TransactionClientContract
      )
    } catch (error) {
      caught = error
    }
    assert.instanceOf(caught, E_PUPITRE_FORBIDDEN)
  })
})
