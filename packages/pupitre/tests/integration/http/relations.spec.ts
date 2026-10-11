import { test } from '@japa/runner'
import {
  actions,
  definePanel,
  defineRelationManager,
  defineResource,
  pages,
  table,
  relationGroup,
} from '../../../index.js'
import { pageProps } from '../../../catalog/wire.js'
import RelationComment from '../../fixtures/models/relation_comment.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import RelationTag from '../../fixtures/models/relation_tag.js'
import RelationRevision from '../../fixtures/models/relation_revision.js'
import { closeTestApp, createTestApp, testSessionAuthentication, User } from '../../helpers/app.js'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'

let parentCanUpdate = true
let tagAttachAllowed = false
let tagCreateAllowed = true
let tagDetachAllowed = false
let tagDeleteAllowed = true
class RelationTagPolicy {
  viewAny() {
    return true
  }
  view() {
    return false
  }
  create() {
    return tagCreateAllowed
  }
  attach() {
    return tagAttachAllowed
  }
  detach() {
    return tagDetachAllowed
  }
  update() {
    return true
  }
  delete() {
    return tagDeleteAllowed
  }
}
class RelationPostPolicy {
  viewAny() {
    return true
  }
  view() {
    return true
  }
  create() {
    return true
  }
  update() {
    return parentCanUpdate
  }
  delete() {
    return true
  }
}

const comments = defineRelationManager(RelationPost, 'comments')
  .label('Comments')
  .recordTitle('title')
  .table((t) => t.columns([table.text('title').sortable().searchable(), table.text('body')]))
  .form((s) => [s.text('title').required(), s.textarea('body').required()])
  .actions({
    header: [actions.create(), actions.associate()],
    row: [actions.edit(), actions.delete(), actions.dissociate()],
    bulk: [actions.bulkDissociate()],
  })

const tags = defineRelationManager(RelationPost, 'tags')
  .label('Tags')
  .recordTitle('name')
  .table((t) => t.columns([table.text('name').sortable().searchable()]))
  .form((s) => [s.text('note')])
  .actions({
    header: [actions.attach()],
    row: [actions.detach(), actions.view()],
    bulk: [actions.bulkDetach()],
  })
const revisions = defineResource(RelationRevision)
  .slug('revisions')
  .label('Revision')
  .pluralLabel('Revisions')
  .parent(RelationPost, 'post')
  .form((s) => [s.text('title').required(), s.textarea('body').required()])
  .table((t) => t.columns([table.text('title')]))
  .pages({ list: pages.list(), create: pages.create(), edit: pages.edit(), view: pages.view() })

const relationPostResource = defineResource(RelationPost)
  .slug('relation-posts')
  .recordTitle('title')
  .policy(RelationPostPolicy)
  .scope((query, ctx) =>
    query.where('tenantId', Number(ctx.request.header('x-relations-tenant') ?? 1))
  )
  .form((s) => [s.text('title').required()])
  .table((t) => t.columns([table.text('title').sortable()]))
  .relations([relationGroup('Content', [comments, tags])])
  .nested([revisions])
  .pages({ list: pages.list(), create: pages.create(), edit: pages.edit(), view: pages.view() })
const relationTagResource = defineResource(RelationTag)
  .slug('relation-tags')
  .recordTitle('name')
  .policy(RelationTagPolicy)
  .form((s) => [s.text('name').required()])
  .mutateBeforeCreate((data) => ({ ...data, tenantId: 1 }))
  .scope((query, ctx) =>
    query.where('tenantId', Number(ctx.request.header('x-relations-tenant') ?? 1))
  )
  .table((t) => t.columns([table.text('name').sortable()]))
  .actions({ row: [actions.delete()] })
  .pages({ list: pages.list().modals() })

const relationPanel = definePanel('admin')
  .path('/admin')
  .guard('web')
  .middleware([testSessionAuthentication])
  .resources({ relationPosts: relationPostResource, relationTags: relationTagResource })
const relationTenantAdapter: TenancyAdapter = {
  async resolve(ctx) {
    return ctx.params.tenant === 'acme' ? { id: 1, name: 'Acme', slug: 'acme' } : null
  },
  scope(query, tenant, options) {
    query.where(options.ownership, tenant.id)
  },
  fill(data, tenant, options) {
    return {
      ...data,
      [options.ownership === 'tenant_id' ? 'tenantId' : options.ownership]: tenant.id,
    }
  },
  async listForUser() {
    return [{ id: 1, name: 'Acme', slug: 'acme' }]
  },
}
const unregisteredRelatedTenancyPanel = definePanel('admin')
  .path('/admin')
  .guard('web')
  .middleware([testSessionAuthentication])
  .tenancy({ mode: 'url', ownership: 'tenant_id', adapter: relationTenantAdapter })
  .resources({ relationPosts: relationPostResource })

async function actionRequest(
  baseUrl: string,
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  cookie: string,
  data?: Record<string, unknown>,
  tenantId = 1
) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Accept': 'application/json',
      'X-Relations-Tenant': String(tenantId),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== 'GET' ? { 'Content-Type': 'application/json', 'X-Pupitre-Action': '1' } : {}),
    },
    ...(data ? { body: JSON.stringify({ data }) } : {}),
  })
}

test.group('relation manager HTTP runtime', (group) => {
  group.each.setup(async () => {
    parentCanUpdate = true
    tagAttachAllowed = false
    tagCreateAllowed = true
    tagDetachAllowed = false
    tagDeleteAllowed = true
  })
  test('scopes relation data, CRUD, attach/detach, associate/dissociate, and readOnly', async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: relationPanel }) },
    })
    try {
      const user = await User.create({
        name: 'Relations Admin',
        email: 'relations@example.test',
        fullName: 'Relations Admin',
        password: 'password',
      })
      const cookie = await fixture.loginAs(user)
      const first = await RelationPost.create({ title: 'Parent one', tenantId: 1 })
      const second = await RelationPost.create({ title: 'Parent two', tenantId: 1 })
      const foreignTenant = await RelationPost.create({
        title: 'Foreign tenant parent',
        tenantId: 2,
      })
      const existing = await RelationComment.create({
        postId: first.id,
        tenantId: 1,
        title: 'First comment',
        body: 'Scoped body',
      })
      const orphan = await RelationComment.create({
        postId: null,
        tenantId: 1,
        title: 'Unassigned comment',
        body: 'Ready to associate',
      })
      const tag = await RelationTag.create({ tenantId: 1, name: 'Research' })

      const list = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/comments?comments%5Bsort%5D=title`,
        'GET',
        cookie
      )
      assert.equal(list.status, 200, await list.clone().text())
      const tableData = (await list.json()) as {
        query: { sort?: string }
        rows: { key: number }[]
      }
      assert.equal(tableData.query.sort, 'title')
      const crossTenant = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${foreignTenant.id}/relations/comments`,
        'GET',
        cookie,
        undefined,
        1
      )
      assert.equal(crossTenant.status, 404)
      assert.deepEqual(
        tableData.rows.map((row: { key: number }) => row.key),
        [existing.id]
      )
      const editPage = await fetch(`${fixture.baseUrl}/admin/relation-posts/${first.id}/edit`, {
        headers: {
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'Cookie': cookie,
        },
        redirect: 'manual',
      })
      assert.equal(editPage.status, 200)
      const editBody = (await editPage.json()) as { props: unknown }
      const editProps = pageProps.parse(editBody.props)
      const root = editProps.page.spec.root
      const elements = editProps.page.spec.elements
      assert.equal(elements[root]?.type, 'Group')
      const formEntries = Object.entries(elements).filter(([, element]) => element.type === 'Form')
      assert.isNotEmpty(formEntries)
      const containsRelationManager = (elementId: string): boolean => {
        const element = elements[elementId]
        if (!element) return false
        if (element.type === 'RelationManager') return true
        if (!('children' in element)) return false
        return (element.children ?? []).some(containsRelationManager)
      }
      for (const [, element] of formEntries) {
        const children = 'children' in element ? (element.children ?? []) : []
        assert.isFalse(children.some(containsRelationManager))
      }
      assert.include(
        editProps.page.subNavigation?.map((item) => item.key) ?? [],
        'nested:revisions'
      )
      assert.deepEqual(
        editProps.page.relations?.map((relation) => relation.group),
        ['Content', 'Content']
      )
      const nestedCreate = await fetch(
        `${fixture.baseUrl}/admin/relation-posts/${first.id}/revisions`,
        {
          method: 'POST',
          headers: {
            'Accept': 'text/html',
            'Content-Type': 'application/json',
            'X-Inertia': 'true',
            'X-Inertia-Version': '1',
            'Cookie': cookie,
            'Referer': `${fixture.baseUrl}/admin/relation-posts/${first.id}/revisions/create`,
          },
          body: JSON.stringify({
            title: 'Nested revision',
            body: 'The parent relationship must overwrite a forged foreign key.',
            postId: second.id,
          }),
          redirect: 'manual',
        }
      )
      assert.isTrue([302, 303].includes(nestedCreate.status), await nestedCreate.clone().text())
      const revision = await RelationRevision.findBy('title', 'Nested revision')
      assert.isNotNull(revision)
      assert.equal(revision?.postId, first.id)
      if (!revision) throw new Error('Expected nested revision to be created')
      const nestedEditPage = await fetch(
        `${fixture.baseUrl}/admin/relation-posts/${first.id}/revisions/${revision.id}/edit`,
        {
          headers: {
            'Accept': 'text/html',
            'X-Inertia': 'true',
            'X-Inertia-Version': '1',
            'Cookie': cookie,
          },
          redirect: 'manual',
        }
      )
      const nestedBody = (await nestedEditPage.json()) as { props: unknown }
      const nestedProps = pageProps.parse(nestedBody.props)
      assert.equal(nestedEditPage.status, 200)
      assert.include(
        nestedProps.page.breadcrumbs.map((crumb) => crumb.label),
        'Parent one'
      )
      const crossParentRevision = await fetch(
        `${fixture.baseUrl}/admin/relation-posts/${second.id}/revisions/${revision.id}/edit`,
        { headers: { Accept: 'text/html', Cookie: cookie }, redirect: 'manual' }
      )
      assert.equal(crossParentRevision.status, 404)

      const wrongParent = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${second.id}/relations/comments/${existing.id}/actions/edit`,
        'GET',
        cookie
      )
      assert.equal(wrongParent.status, 404)

      const create = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/comments/actions/create`,
        'POST',
        cookie,
        { title: 'Created comment', body: 'Filled through the parent relation' }
      )
      assert.equal(create.status, 200, await create.clone().text())
      const created = await RelationComment.findBy('title', 'Created comment')
      assert.isNotNull(created)
      assert.equal(created?.postId, first.id)

      const associate = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/comments/actions/associate`,
        'POST',
        cookie,
        { ids: [orphan.id] }
      )
      assert.equal(associate.status, 200, await associate.clone().text())
      await orphan.refresh()
      assert.equal(orphan.postId, first.id)

      const dissociate = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/comments/${orphan.id}/actions/dissociate`,
        'POST',
        cookie,
        {}
      )
      assert.equal(dissociate.status, 200, await dissociate.clone().text())
      await orphan.refresh()
      assert.isNull(orphan.postId)

      const deniedAttachForm = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/actions/attach`,
        'GET',
        cookie
      )
      assert.equal(deniedAttachForm.status, 403)
      const deniedAttach = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/actions/attach`,
        'POST',
        cookie,
        { ids: [tag.id] }
      )
      assert.equal(deniedAttach.status, 403)
      assert.lengthOf(await first.related('tags').query(), 0)
      tagAttachAllowed = true
      const attachForm = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/actions/attach`,
        'GET',
        cookie
      )
      assert.equal(attachForm.status, 200, await attachForm.clone().text())
      const form = (await attachForm.json()) as {
        spec: { elements: Record<string, { props?: Record<string, unknown> }> }
      }
      const idsField = Object.values(form.spec.elements).find(
        (element) => element.props?.name === 'ids'
      )
      assert.equal(
        idsField?.props?.optionsUrl,
        `/admin/relation-posts/${first.id}/relations/tags/actions/attach/options`
      )
      const options = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/actions/attach/options?q=Research`,
        'GET',
        cookie
      )
      assert.equal(options.status, 200, await options.clone().text())
      const optionData = (await options.json()) as {
        options: { value: string | number; label: string }[]
        hasMore: boolean
      }
      assert.deepEqual(optionData.options, [{ value: tag.id, label: 'Research' }])
      const attach = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/actions/attach`,
        'POST',
        cookie,
        { ids: [tag.id], note: 'pivot note' }
      )
      assert.equal(attach.status, 200, await attach.clone().text())
      const deniedRelatedView = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/${tag.id}/actions/view`,
        'GET',
        cookie
      )
      assert.equal(deniedRelatedView.status, 403)
      const deniedRelatedViewRun = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/${tag.id}/actions/view`,
        'POST',
        cookie,
        {}
      )
      assert.equal(deniedRelatedViewRun.status, 403)
      const attachedTags = await first.related('tags').query()
      assert.equal(attachedTags.length, 1)
      const pivot = await fixture.database
        .from('relation_post_tags')
        .where('post_id', first.id)
        .where('tag_id', tag.id)
        .first()
      assert.equal(pivot?.note, 'pivot note')
      const bulkDetachRoute = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/actions/bulk-detach`,
        'POST',
        cookie,
        { ids: [] }
      )
      assert.equal(bulkDetachRoute.status, 422, await bulkDetachRoute.clone().text())
      const deniedDetach = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/${tag.id}/actions/detach`,
        'POST',
        cookie,
        {}
      )
      assert.equal(deniedDetach.status, 403)
      assert.lengthOf(await first.related('tags').query(), 1)
      tagDetachAllowed = true
      const detach = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/tags/${tag.id}/actions/detach`,
        'POST',
        cookie,
        {}
      )
      assert.equal(detach.status, 200, await detach.clone().text())
      const detachedTags = await first.related('tags').query()
      assert.equal(detachedTags.length, 0)
      const noCreatePage = await actionRequest(
        fixture.baseUrl,
        '/admin/relation-tags/create',
        'GET',
        cookie
      )
      assert.equal(noCreatePage.status, 404)
      const noEditPage = await actionRequest(
        fixture.baseUrl,
        '/admin/relation-tags/1/edit',
        'GET',
        cookie
      )
      assert.equal(noEditPage.status, 404)
      const modalForm = await actionRequest(
        fixture.baseUrl,
        '/admin/relation-tags/actions/create',
        'GET',
        cookie
      )
      assert.equal(modalForm.status, 200, await modalForm.clone().text())
      const modalCreate = await actionRequest(
        fixture.baseUrl,
        '/admin/relation-tags/actions/create',
        'POST',
        cookie,
        { name: 'Created in modal' }
      )
      assert.equal(modalCreate.status, 200, await modalCreate.clone().text())
      const modalTag = await RelationTag.findBy('name', 'Created in modal')
      if (!modalTag) throw new Error('Expected modal tag to be created')
      const editModalForm = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-tags/${modalTag.id}/actions/edit`,
        'GET',
        cookie
      )
      assert.equal(editModalForm.status, 200, await editModalForm.clone().text())
      const modalUpdate = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-tags/${modalTag.id}/actions/edit`,
        'POST',
        cookie,
        { name: 'Updated in modal' }
      )
      assert.equal(modalUpdate.status, 200, await modalUpdate.clone().text())
      await modalTag.refresh()
      assert.equal(modalTag.name, 'Updated in modal')

      parentCanUpdate = false
      const page = await fetch(`${fixture.baseUrl}/admin/relation-posts/${first.id}`, {
        headers: {
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'Cookie': cookie,
        },
        redirect: 'manual',
      })
      assert.equal(page.status, 200)
      const response = (await page.json()) as { props: unknown }
      const props = pageProps.parse(response.props)
      assert.isTrue(props.page.relations?.every((item) => item.readOnly))
      const denied = await actionRequest(
        fixture.baseUrl,
        `/admin/relation-posts/${first.id}/relations/comments/actions/create`,
        'POST',
        cookie,
        { title: 'Denied', body: 'No mutation' }
      )
      assert.equal(denied.status, 403)
    } finally {
      parentCanUpdate = true
      await closeTestApp(fixture)
    }
  })
  test('tenant-scopes unregistered related models for options and attach-by-id', async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: unregisteredRelatedTenancyPanel }) },
    })
    try {
      const user = await User.create({
        name: 'Tenant relations admin',
        email: `tenant-relations-${Date.now()}@example.test`,
      })
      const cookie = await fixture.loginAs(user)
      const parent = await RelationPost.create({ title: 'Tenant parent', tenantId: 1 })
      const localTag = await RelationTag.create({ name: 'Local tenant tag', tenantId: 1 })
      const foreignTag = await RelationTag.create({ name: 'Foreign tenant tag', tenantId: 2 })
      const options = await actionRequest(
        fixture.baseUrl,
        `/admin/acme/relation-posts/${parent.id}/relations/tags/actions/attach/options?q=tenant%20tag`,
        'GET',
        cookie
      )
      assert.equal(options.status, 200, await options.clone().text())
      const result = (await options.json()) as {
        options: { value: string | number; label: string }[]
      }
      assert.deepEqual(result.options, [{ value: localTag.id, label: 'Local tenant tag' }])
      const attach = await actionRequest(
        fixture.baseUrl,
        `/admin/acme/relation-posts/${parent.id}/relations/tags/actions/attach`,
        'POST',
        cookie,
        { ids: [foreignTag.id] }
      )
      assert.equal(attach.status, 404)
      const attachedTags = await parent.related('tags').query()
      assert.equal(attachedTags.length, 0)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
