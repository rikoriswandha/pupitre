import { z } from 'zod'
import { actionResult, pageProps } from '../../../catalog/wire.js'
import { test } from '@japa/runner'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  failFixtureAfterCreate,
  failFixtureAfterSave,
  fixtureHookEventsSnapshot,
  resetFixtureHooks,
  Post,
  Category,
  User,
} from '../../helpers/app.js'
import PostLink from '../../fixtures/models/post_link.js'

function sessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ')
}

async function inertia(
  baseUrl: string,
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = '',
  action = false
) {
  return fetch(`${baseUrl}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      'Accept': 'text/html',
      'X-Inertia': 'true',
      'X-Inertia-Version': '1',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(action ? { 'X-Pupitre-Action': '1', 'Accept': 'application/json' } : {}),
      'Referer': `${baseUrl}/admin/posts/create`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}
async function responseProps(response: Response) {
  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`Inertia response is not JSON: ${text}`)
  }
  if (!body || typeof body !== 'object' || !('props' in body))
    throw new Error('Inertia response did not contain props')
  return pageProps.parse(body.props)
}

const validationResponse = z.object({ errors: z.record(z.string(), z.array(z.string())) })

test.group('Pupitre CRUD HTTP runtime', () => {
  test('renders create, edit, view and 404 pages with stored values', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      const dashboard = await fetch(`${fixture.baseUrl}/admin`, { redirect: 'manual' })
      assert.equal(dashboard.status, 302)
      assert.equal(dashboard.headers.get('location'), '/admin/posts')
      const create = await inertia(fixture.baseUrl, '/admin/posts/create')
      assert.equal(create.status, 200, await create.clone().text())
      const headerNames = (props: z.infer<typeof pageProps>) =>
        (props.page.actions?.header ?? []).map((action) => action.name)
      // Collection builtins stay on the list; record pages link to each other, never to themselves.
      assert.deepEqual(headerNames(await responseProps(create)), ['record-header'])
      const record = await Post.create({
        title: 'HTTP row',
        slug: 'http-row',
        status: 'draft',
        tenantId: 1,
      })
      const edit = await inertia(fixture.baseUrl, `/admin/posts/${record.id}/edit`)
      const editPage = await responseProps(edit)
      assert.deepEqual(headerNames(editPage), ['record-header', 'view', 'delete'])
      assert.equal(edit.status, 200)
      assert.equal(editPage.page.kind, 'edit')
      assert.equal(editPage.page.spec.elements.root?.props.method, 'put')
      assert.equal(editPage.page.spec.elements.root?.props.url, `/admin/posts/${record.id}`)
      assert.equal(
        z.object({ title: z.string() }).parse(editPage.page.state.data).title,
        'HTTP row'
      )
      const view = await inertia(fixture.baseUrl, `/admin/posts/${record.id}`)
      assert.equal(view.status, 200)
      const viewProps = await responseProps(view)
      assert.deepEqual(headerNames(viewProps), ['record-header', 'edit', 'delete'])
      assert.equal(viewProps.page.kind, 'view')
      assert.deepEqual(
        viewProps.page.breadcrumbs.slice(-2).map((crumb) => crumb.label),
        ['HTTP row', 'View']
      )
      const missing = await inertia(fixture.baseUrl, '/admin/posts/999999/edit')
      assert.equal(missing.status, 404)

      // Record tabs follow the same abilities as the pages they open.
      const tabKeys = (props: z.infer<typeof pageProps>) =>
        (props.page.subNavigation ?? []).map((item) => item.key)
      assert.deepEqual(tabKeys(viewProps), ['edit', 'view'])
      denyPolicyAbility('update')
      const readOnly = await responseProps(
        await inertia(fixture.baseUrl, `/admin/posts/${record.id}`)
      )
      assert.deepEqual(tabKeys(readOnly), ['view'])
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
  test('keeps record values and URLs distinct across cache-enabled controller renders', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const first = await Post.create({
        title: 'Cache first record',
        slug: 'cache-first-record',
        status: 'draft',
        tenantId: 1,
      })
      const second = await Post.create({
        title: 'Cache second record',
        slug: 'cache-second-record',
        status: 'draft',
        tenantId: 1,
      })
      const firstResponse = await inertia(fixture.baseUrl, `/admin/posts/${first.id}/edit`)
      const secondResponse = await inertia(fixture.baseUrl, `/admin/posts/${second.id}/edit`)
      const firstPage = await responseProps(firstResponse)
      const secondPage = await responseProps(secondResponse)
      assert.equal(
        (firstPage.page.state.data as Record<string, unknown>).title,
        'Cache first record'
      )
      assert.equal(
        (secondPage.page.state.data as Record<string, unknown>).title,
        'Cache second record'
      )
      assert.equal(firstPage.page.spec.elements.root?.props.url, `/admin/posts/${first.id}`)
      assert.equal(secondPage.page.spec.elements.root?.props.url, `/admin/posts/${second.id}`)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('JSON store, update and destroy responses do not leave session flash messages', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const values = {
        title: 'JSON flash isolation',
        slug: 'json-flash-isolation',
        status: 'draft',
      }
      const created = await inertia(fixture.baseUrl, '/admin/posts', 'POST', values, '', true)
      assert.equal(created.status, 200)
      const createResult = actionResult.parse(await created.json())
      const id = Number(createResult.redirect?.match(/posts\/(\d+)\/edit$/)?.[1])
      assert.isNumber(id)
      let cookie = sessionCookie(created)
      const noFlashAfterCreate = await inertia(
        fixture.baseUrl,
        '/admin/posts',
        'GET',
        undefined,
        cookie
      )
      const afterCreateProps = await responseProps(noFlashAfterCreate)
      assert.deepEqual(afterCreateProps.pupitre.flash, [])

      const updated = await inertia(
        fixture.baseUrl,
        `/admin/posts/${id}`,
        'PUT',
        { ...values, title: 'Updated JSON flash isolation' },
        cookie,
        true
      )
      assert.equal(updated.status, 200, await updated.text())
      cookie = sessionCookie(updated) || cookie
      const noFlashAfterUpdate = await inertia(
        fixture.baseUrl,
        `/admin/posts/${id}/edit`,
        'GET',
        undefined,
        cookie
      )
      const afterUpdateProps = await responseProps(noFlashAfterUpdate)
      assert.deepEqual(afterUpdateProps.pupitre.flash, [])

      const destroyed = await inertia(
        fixture.baseUrl,
        `/admin/posts/${id}`,
        'DELETE',
        undefined,
        cookie,
        true
      )
      assert.equal(destroyed.status, 200, await destroyed.text())
      cookie = sessionCookie(destroyed) || cookie
      const noFlashAfterDestroy = await inertia(
        fixture.baseUrl,
        '/admin/posts',
        'GET',
        undefined,
        cookie
      )
      const afterDestroyProps = await responseProps(noFlashAfterDestroy)
      assert.deepEqual(afterDestroyProps.pupitre.flash, [])
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('creates and updates hasMany repeater rows through the resource routes', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const values = {
        title: 'HTTP repeater relationship',
        slug: 'http-repeater-relationship',
        status: 'draft',
        links: [{ label: 'Project', url: 'https://example.test/project' }],
      }
      const created = await inertia(fixture.baseUrl, '/admin/posts', 'POST', values, '', true)
      assert.equal(created.status, 200, await created.clone().text())
      const createResult = actionResult.parse(await created.json())
      const id = Number(createResult.redirect?.match(/posts\/(\d+)\/edit$/)?.[1])
      assert.isNumber(id)

      let rows = await PostLink.query().where('post_id', id)
      assert.lengthOf(rows, 1)
      assert.equal(rows[0]?.label, 'Project')

      const updated = await inertia(
        fixture.baseUrl,
        `/admin/posts/${id}`,
        'PUT',
        {
          ...values,
          title: 'Updated HTTP repeater relationship',
          links: [
            {
              _relationKey: rows[0]!.id,
              label: 'Updated project',
              url: 'https://example.test/new',
            },
            { label: 'Documentation', url: 'https://example.test/docs' },
          ],
        },
        '',
        true
      )
      assert.equal(updated.status, 200, await updated.clone().text())
      rows = await PostLink.query().where('post_id', id).orderBy('sort')
      assert.deepEqual(
        rows.map((row) => ({ label: row.label, sort: row.sort })),
        [
          { label: 'Updated project', sort: 0 },
          { label: 'Documentation', sort: 1 },
        ]
      )
      const edit = await inertia(fixture.baseUrl, `/admin/posts/${id}/edit`)
      const editProps = await responseProps(edit)
      assert.equal(edit.status, 200)
      const relationState = z
        .object({ links: z.array(z.object({ label: z.string() })) })
        .parse(editProps.page.state.data)
      assert.deepEqual(
        relationState.links.map((row) => row.label),
        ['Updated project', 'Documentation']
      )
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('preloads relations used by dotted table columns', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      const category = await Category.create({ name: 'Preloaded category' })
      await Post.create({
        title: 'Relation cell',
        slug: 'relation-cell',
        status: 'draft',
        categoryId: category.id,
        metadata: { title: 'JSON dotted value' },
        tenantId: 1,
      })
      const response = await inertia(fixture.baseUrl, '/admin/posts?q=Relation%20cell')
      const props = (await responseProps(response)) as {
        data?: {
          rows: {
            cells: Record<string, unknown>
            actions: { name: string; keyBindings?: string[] }[]
          }[]
        }
      }
      assert.isUndefined(
        props.data?.rows[0]?.actions.find((action) => action.name === 'archive')?.keyBindings
      )
      assert.equal(response.status, 200)
      assert.equal(props.data?.rows[0]?.cells['category.name'], 'Preloaded category')
      assert.equal(props.data?.rows[0]?.cells['metadata.title'], 'JSON dotted value')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('enforces a panel guard without a route auth middleware', async ({ assert }) => {
    const fixture = await createTestApp({ panelGuard: 'web' })
    try {
      const response = await fetch(`${fixture.baseUrl}/admin/posts`, {
        headers: { Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.notEqual(response.status, 200)
      assert.oneOf(response.status, [302, 401, 403])
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('fails closed when a configured policy has no initialized Bouncer', async ({ assert }) => {
    const fixture = await createTestApp({ withoutBouncer: true })
    try {
      const response = await fetch(`${fixture.baseUrl}/admin/posts`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(response.status, 500)
      assert.include(await response.text(), 'initialize middleware')
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('authenticates the fixture user through the session guard', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      const user = await User.create({
        name: 'Fixture Admin',
        email: `admin-${Date.now()}@example.test`,
      })
      const cookie = await fixture.loginAs(user)
      const response = await inertia(fixture.baseUrl, '/admin/posts', 'GET', undefined, cookie)
      assert.equal(response.status, 200)
      const props = await responseProps(response)
      assert.equal(props.pupitre.user?.id, user.id)
      assert.equal(props.pupitre.user?.name, 'Fixture Admin')
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('uses slug as the registered route identity and honors breadcrumb settings', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ resourceSlug: 'articles', breadcrumbs: false })
    try {
      const post = await Post.create({
        title: 'Record title label',
        slug: 'record-title-label',
        status: 'draft',
        tenantId: 1,
      })
      const response = await inertia(fixture.baseUrl, '/admin/articles')
      assert.equal(response.status, 200)
      const page = await inertia(fixture.baseUrl, `/admin/articles/${post.id}`)
      const props = await responseProps(page)
      assert.equal(page.status, 200)
      assert.deepEqual(props.page.breadcrumbs, [])
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('validates, creates, updates and destroys records with transactional hooks', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      resetFixtureHooks()
      failFixtureAfterCreate()
      const failedCreate = await inertia(fixture.baseUrl, '/admin/posts', 'POST', {
        title: 'Rollback custom create handler',
        slug: 'rollback-custom-create-handler',
        status: 'draft',
      })
      assert.equal(failedCreate.status, 500)
      assert.isNull(await Post.query().where('slug', 'rollback-custom-create-handler').first())
      failFixtureAfterCreate(false)
      const invalid = await inertia(fixture.baseUrl, '/admin/posts', 'POST', {}, '', true)
      const invalidText = await invalid.text()
      assert.equal(invalid.status, 422, invalidText)
      assert.property(validationResponse.parse(JSON.parse(invalidText)).errors, 'title')
      const invalidWeb = await inertia(fixture.baseUrl, '/admin/posts', 'POST', {})
      assert.equal(invalidWeb.status, 302)

      const values = { title: 'Created over HTTP', slug: 'created-over-http', status: 'draft' }
      const actionCreated = await inertia(
        fixture.baseUrl,
        '/admin/posts',
        'POST',
        { ...values, slug: 'action-created-over-http' },
        '',
        true
      )
      assert.equal(actionCreated.status, 200)
      assert.match(
        actionResult.parse(await actionCreated.json()).redirect ?? '',
        /\/admin\/posts\/\d+\/edit$/
      )
      resetFixtureHooks()
      const created = await inertia(fixture.baseUrl, '/admin/posts', 'POST', values)
      assert.equal(created.status, 302)
      const editUrl = created.headers.get('location')
      assert.match(editUrl ?? '', /\/admin\/posts\/\d+\/edit$/)
      assert.deepEqual(fixtureHookEventsSnapshot(), [
        'mutateBeforeCreate',
        'mutateBeforeSave',
        'beforeCreate',
        'beforeSave',
        'afterCreate',
        'afterSave',
      ])
      const id = Number(editUrl?.match(/posts\/(\d+)/)?.[1])
      assert.isNumber(id)
      const nextPage = await inertia(
        fixture.baseUrl,
        editUrl!,
        'GET',
        undefined,
        sessionCookie(created)
      )
      const nextPageProps = await responseProps(nextPage)
      assert.equal(nextPageProps.pupitre.flash[0]?.title, 'Created')

      const invalidUpdate = await inertia(
        fixture.baseUrl,
        `/admin/posts/${id}`,
        'PUT',
        {},
        sessionCookie(created)
      )
      assert.equal(invalidUpdate.status, 303)
      resetFixtureHooks()
      failFixtureAfterSave()
      const failedUpdate = await inertia(fixture.baseUrl, `/admin/posts/${id}`, 'PUT', {
        ...values,
        title: 'Rollback should preserve',
      })
      assert.equal(failedUpdate.status, 500)
      const savedAfterFailure = await Post.findOrFail(id)
      assert.equal(savedAfterFailure.title, 'Created over HTTP')
      failFixtureAfterSave(false)
      const updatedWeb = await inertia(
        fixture.baseUrl,
        `/admin/posts/${id}`,
        'PUT',
        { ...values, title: 'Updated over HTTP' },
        sessionCookie(created)
      )
      assert.equal(updatedWeb.status, 303)
      assert.equal(updatedWeb.headers.get('location'), `/admin/posts/${id}/edit`)
      const savedAfterUpdate = await Post.findOrFail(id)
      assert.equal(savedAfterUpdate.title, 'Updated over HTTP')

      const updated = await inertia(
        fixture.baseUrl,
        `/admin/posts/${id}`,
        'PUT',
        { ...values, title: 'Updated over HTTP' },
        '',
        true
      )
      assert.equal(updated.status, 200)
      assert.equal(actionResult.parse(await updated.json()).redirect, `/admin/posts/${id}/edit`)
      const deletedWeb = await inertia(
        fixture.baseUrl,
        `/admin/posts/${id}`,
        'DELETE',
        undefined,
        sessionCookie(created)
      )
      assert.equal(deletedWeb.status, 303)
      assert.isNull(await Post.find(id))
      const actionRecord = await Post.create({
        title: 'Action delete',
        slug: 'action-delete',
        status: 'draft',
        tenantId: 1,
      })
      const deleted = await inertia(
        fixture.baseUrl,
        `/admin/posts/${actionRecord.id}`,
        'DELETE',
        undefined,
        '',
        true
      )
      assert.equal(deleted.status, 200)
      assert.equal(actionResult.parse(await deleted.json()).redirect, '/admin/posts')
      assert.isNull(await Post.find(actionRecord.id))
    } finally {
      failFixtureAfterSave(false)
      await closeTestApp(fixture)
    }
  })
  test('filters denied resources from navigation and dashboard', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      denyPolicyAbility('viewAny')
      const categories = await inertia(fixture.baseUrl, '/admin/categories')
      const categoryPage = await responseProps(categories)
      const navLabels = categoryPage.pupitre.nav.flatMap((group) =>
        group.items.map((item) => item.label)
      )
      assert.notInclude(navLabels, 'Posts')
      assert.include(navLabels, 'Categories')
      const dashboard = await fetch(`${fixture.baseUrl}/admin`, { redirect: 'manual' })
      assert.equal(dashboard.status, 302)
      assert.equal(dashboard.headers.get('location'), '/admin/categories')
      allowPolicyAbilities()
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
})
