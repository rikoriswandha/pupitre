import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { definePanel, definePage, E_PUPITRE_FORBIDDEN } from '@rikology/pupitre'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixturePostResource,
  Post,
} from '../../pupitre/tests/helpers/app.js'
import { calendar, calendarDates, calendarWidget, resourceEvents } from '../index.js'

test('calendar passes the requested UTC range and filters without mutating builders', async ({
  assert,
}) => {
  const original = calendarWidget('events').events(async ({ start, end, filters }) => {
    assert.equal(start, '2026-10-01T00:00:00.000Z')
    assert.equal(end, '2026-11-01T00:00:00.000Z')
    assert.equal(filters.status, 'published')
    return [{ id: 'one', title: 'One', start }]
  })
  const configured = original.views(['week', 'list']).initialView('week').firstDayOfWeek(0)
  const ctx = { pupitre: { timezone: 'Asia/Jakarta' } } as HttpContext
  const result = (await configured.toDefinition().load!({
    ctx,
    filters: { start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z', status: 'published' },
  })) as { views: string[]; firstDayOfWeek: number; events: unknown[] }
  assert.deepEqual(result.views, ['week', 'list'])
  assert.equal(result.firstDayOfWeek, 0)
  assert.lengthOf(result.events, 1)
  assert.notEqual(original.toJSON(), configured.toJSON())
})
test('calendar dates preserve offsets, convert local timezone and reject DST gaps and reversed ranges', ({
  assert,
}) => {
  assert.equal(
    calendarDates('2026-10-13T10:00', undefined, 'Asia/Jakarta').start.toISO(),
    '2026-10-13T03:00:00.000Z'
  )
  assert.equal(
    calendarDates('2026-10-13T10:00+02:00', undefined, 'Asia/Jakarta').start.toISO(),
    '2026-10-13T08:00:00.000Z'
  )
  assert.throws(() => calendarDates('2026-03-29T02:30', undefined, 'Europe/Amsterdam'))
  assert.throws(() => calendarDates('bad', undefined, 'UTC'))
  assert.throws(() => calendarDates('2026-10-13', '2026-10-12', 'UTC'))
})
test('resource calendar scopes tenants, checks URLs and move permission, validates and persists UTC', async ({
  assert,
}) => {
  allowPolicyAbilities()
  const widget = calendarWidget('posts-calendar').events(
    resourceEvents(fixturePostResource, { start: 'published_at' })
  )
  const panel = definePanel('admin')
    .path('/admin')
    .timezone('Asia/Jakarta')
    .resources({ posts: fixturePostResource })
    .tenancy({
      mode: 'url',
      adapter: {
        resolve: async (ctx) => ({
          id: ctx.params.tenant === 'acme' ? 1 : 2,
          name: 'Tenant',
          slug: String(ctx.params.tenant),
        }),
        scope: (query, tenant) => {
          query.where('tenant_id', tenant.id)
        },
        fill: (data, tenant) => ({ ...data, tenantId: tenant.id }),
        listForUser: async () => [],
      },
    })
    .plugins([calendar({ pages: [definePage('calendar').widgets([widget])] })])
  const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  const endpoint = `${fixture.baseUrl}/admin/acme/_pupitre/widgets/posts-calendar`
  const params = '?customPage=calendar&start=2026-10-01T00%3A00%3A00Z&end=2026-11-01T00%3A00%3A00Z'
  const load = async () => fetch(endpoint + params)
  const move = async (id: number, start: string) =>
    fetch(`${endpoint}/actions/reschedule${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Pupitre-Action': '1',
      },
      body: JSON.stringify({ data: { id: String(id), start, allDay: false } }),
    })
  try {
    const own = await Post.create({
      title: 'Own calendar',
      slug: 'own-calendar',
      tenantId: 1,
      status: 'published',
      publishedAt: DateTime.fromISO('2026-10-13T03:00:00Z'),
    })
    const foreign = await Post.create({
      title: 'Foreign calendar',
      slug: 'foreign-calendar',
      tenantId: 2,
      status: 'published',
      publishedAt: own.publishedAt,
    })
    let response = await load()
    assert.equal(response.status, 200, await response.clone().text())
    let payload = (await response.json()) as {
      data: { events: { id: string; url?: string; editable: boolean; start: string }[] }
    }
    assert.deepEqual(
      payload.data.events.map((event) => event.id),
      [String(own.id)]
    )
    assert.include(payload.data.events[0].start, '+07:00')
    assert.isString(payload.data.events[0].url)
    denyPolicyAbility('view')
    response = await load()
    payload = (await response.json()) as typeof payload
    assert.isUndefined(payload.data.events[0].url)
    denyPolicyAbility('update')
    const forbidden = await move(own.id, '2026-10-14T11:00')
    assert.equal(forbidden.status, 403, await forbidden.text())
    allowPolicyAbilities()
    const invisible = await move(foreign.id, '2026-10-14T11:00')
    assert.equal(invisible.status, 404)
    const invalid = await move(own.id, 'not-a-date')
    assert.equal(invalid.status, 422)
    const saved = await move(own.id, '2026-10-14T11:00')
    assert.equal(saved.status, 200, await saved.text())
    await own.refresh()
    assert.equal(own.publishedAt!.toUTC().toISO(), '2026-10-14T04:00:00.000Z')
    denyPolicyAbility('viewAny')
    const forbiddenRange = await load()
    assert.include([403, 404], forbiddenRange.status)
  } finally {
    allowPolicyAbilities()
    await closeTestApp(fixture)
  }
})

test('custom calendar move rechecks the original event permission in the displayed range', async ({
  assert,
}) => {
  let allowed = true
  let moves = 0
  const ctx = {
    pupitre: { timezone: 'UTC' },
    request: { qs: () => ({ start: '2027-01-01T00:00:00Z', end: '2027-02-01T00:00:00Z' }) },
  } as unknown as HttpContext
  const widget = calendarWidget('custom')
    .events(async ({ start }) => {
      assert.equal(start, '2027-01-01T00:00:00Z')
      return [{ id: 'one', title: 'Appointment', start: '2027-01-10T10:00:00Z' }]
    })
    .editable({
      can: async (_ctx, event) => allowed && event.id === 'one',
      move: async () => {
        moves++
      },
    })
    .toDefinition()
  const handler = widget.actions![0].handle!
  const data = { id: 'one', start: '2027-01-11T11:00', allDay: false }
  await handler({ ctx, data })
  assert.equal(moves, 1)
  allowed = false
  await assert.rejects(async () => {
    await handler({ ctx, data })
  }, E_PUPITRE_FORBIDDEN)
  assert.equal(moves, 1)
})
