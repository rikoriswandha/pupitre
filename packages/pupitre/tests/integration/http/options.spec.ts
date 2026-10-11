import { z } from 'zod'
import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { action, definePage, schema } from '../../../index.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  CategoryPolicy,
  fixtureCategoryResource,
  fixturePanel,
  fixturePostResource,
  Category,
  Post,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import { seed, teardown, truncate } from '../../helpers/db.js'
import { actionFormResponse, optionsResponse, pageProps } from '../../../catalog/wire.js'
let denyRelatedViewAny = false
let denyRelatedCreate = false
class OptionsCategoryPolicy {
  viewAny() {
    return !denyRelatedViewAny
  }
  create() {
    return !denyRelatedCreate
  }
}

let resourceFieldActionRuns = 0
let textSuffixActionRuns = 0
let pageFieldActionRuns = 0
const resourceFieldAction = {
  name: 'static-field-action',
  kind: 'action' as const,
  context: 'header' as const,
  can: 'create',
  handle: async () => {
    resourceFieldActionRuns += 1
  },
}
const textSuffixAction = action('text-suffix-action').handle(async () => {
  textSuffixActionRuns += 1
})
const pageFieldAction = action('page-field-action')
  .can('page-field-action')
  .handle(async () => {
    pageFieldActionRuns += 1
  })
const pageFieldActionDefinition = { ...pageFieldAction.definition, context: 'header' as const }
const actionSelectPage = definePage('action-select')
  .path('/action-select')
  .form((form) => [
    form.select('status').options({ draft: 'Draft' }).suffixAction(pageFieldActionDefinition),
  ])
  .actions([pageFieldAction])
async function inertiaPage(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Accept': 'text/html',
      'X-Inertia': 'true',
      'X-Inertia-Version': '1',
      'Connection': 'close',
    },
  })
  if (response.status !== 200) throw new Error(await response.text())
  const body = z.object({ props: pageProps }).parse(await response.json())
  return { response, page: body.props.page }
}

const optionsPost = fixturePostResource.form((form) =>
  form.components([
    schema.text('title').required().suffixAction(textSuffixAction.definition),
    schema.text('slug').required(),
    schema
      .select('categoryId')
      .relationship('category', 'name', (query) => query.where('name', 'like', 'Option%'))
      .searchable()
      .createOptionForm([schema.text('name').required()]),
    schema
      .select('resolvedCode')
      .options(({ search, values }) =>
        [{ value: 'code-42', label: 'Readable label' }].filter(
          (option) =>
            values?.some((value) => String(value) === String(option.value)) ||
            option.label.toLowerCase().includes(search.toLowerCase())
        )
      ),
    schema.select('staticStatus').options({ draft: 'Draft' }).suffixAction(resourceFieldAction),
    schema.select('preloadedCategoryId').relationship('category', 'name').preload(),
    schema
      .repeater('items')
      .schema([schema.select('categoryId').relationship('category', 'name').searchable()]),
    schema.wizard([
      schema
        .step('Details')
        .components([schema.select('wizardCategory').relationship('category', 'name')]),
    ]),
    schema
      .builder('article')
      .blocks([
        schema
          .block('metadata')
          .schema([schema.select('blockCategory').relationship('category', 'name')]),
      ]),
  ])
)
const scopedCategoryResource = fixtureCategoryResource
  .scope((query) => query.where('tenant_id', 1))
  .policy(OptionsCategoryPolicy)
const optionsPanel = fixturePanel
  .resources({
    posts: optionsPost,
    categories: scopedCategoryResource,
  })
  .pages([actionSelectPage])

let fixture: TestApplication

test.group('Pupitre dynamic select options', (group) => {
  group.setup(async () => {
    fixture = await createTestApp({
      panels: { admin: async () => ({ default: optionsPanel }) },
      pupitre: { policies: async () => ({ CategoryPolicy }) },
      setup: (router) => {
        router.use([
          async () => ({
            default: class {
              async handle(ctx: HttpContext, next: NextFn) {
                const bouncer = (
                  ctx as HttpContext & {
                    bouncer: { allows(ability: string): Promise<boolean> }
                  }
                ).bouncer
                const allows = bouncer.allows.bind(bouncer)
                bouncer.allows = async (ability) =>
                  ability === 'page-field-action' || allows(ability)
                return next()
              }
            },
          }),
        ])
      },
    })
  })
  group.teardown(async () => {
    denyRelatedViewAny = false
    denyRelatedCreate = false
    allowPolicyAbilities()
    await closeTestApp(fixture)
    await teardown()
  })

  test('searches, pages, resolves selected labels, and supports nested field paths', async ({
    assert,
  }) => {
    await truncate()
    const names = Array.from(
      { length: 23 },
      (_, index) => `Option ${String(index).padStart(2, '0')}`
    )
    await seed({
      categories: [
        ...names.map((name) => ({ name, tenantId: 1 })),
        { name: 'Option hidden tenant', tenantId: 2 },
        { name: 'Hidden by relationship scope', tenantId: 1 },
      ],
    })
    const first = await fetch(
      `${fixture.baseUrl}/admin/_pupitre/options/posts/categoryId?q=oPTION`,
      {
        headers: { Accept: 'application/json', Connection: 'close' },
      }
    )
    const firstBody = optionsResponse.parse(await first.json())
    assert.equal(first.status, 200)
    assert.lengthOf(firstBody.options, 20)
    assert.isTrue(firstBody.hasMore)

    const selected = firstBody.options[0]!.value
    const second = await fetch(
      `${fixture.baseUrl}/admin/_pupitre/options/posts/categoryId?q=Option&page=2&selected%5B%5D=${selected}`,
      {
        headers: { Accept: 'application/json', Connection: 'close' },
      }
    )
    const secondBody = optionsResponse.parse(await second.json())
    assert.equal(second.status, 200)
    assert.equal(secondBody.options[0]?.value, selected)
    assert.equal(secondBody.options[0]?.label, 'Option 00')
    assert.isFalse(secondBody.hasMore)

    const nested = await fetch(
      `${fixture.baseUrl}/admin/_pupitre/options/posts/items.categoryId?q=Option`,
      {
        headers: { Accept: 'application/json', Connection: 'close' },
      }
    )
    assert.equal(nested.status, 200)
    const wizardNested = await fetch(
      `${fixture.baseUrl}/admin/_pupitre/options/posts/wizardCategory?q=Option`,
      { headers: { Accept: 'application/json', Connection: 'close' } }
    )
    assert.equal(wizardNested.status, 200)
    const builderNested = await fetch(
      `${fixture.baseUrl}/admin/_pupitre/options/posts/article.metadata.data.blockCategory?q=Option`,
      { headers: { Accept: 'application/json', Connection: 'close' } }
    )
    assert.equal(builderNested.status, 200)
    const closureSelection = await fetch(
      `${fixture.baseUrl}/admin/_pupitre/options/posts/resolvedCode?selected%5B%5D=code-42`,
      { headers: { Accept: 'application/json', Connection: 'close' } }
    )
    const closureBody = optionsResponse.parse(await closureSelection.json())
    assert.deepEqual(closureBody.options, [{ value: 'code-42', label: 'Readable label' }])
  })
  test('compiles and executes static select actions for resource and page forms', async ({
    assert,
  }) => {
    resourceFieldActionRuns = 0
    pageFieldActionRuns = 0
    const resourcePage = await inertiaPage(fixture.baseUrl, '/admin/posts/create')
    const resourceAction = resourcePage.page.spec.elements['f.staticStatus']?.props.suffixAction as
      { url: string; enabled: boolean } | undefined
    assert.deepEqual(resourceAction, {
      name: 'static-field-action',
      label: 'static-field-action',
      kind: 'direct',
      url: '/admin/posts/actions/static-field-action',
      method: 'post',
      enabled: true,
    })
    const resourceResult = await fetch(new URL(resourceAction!.url, fixture.baseUrl), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Pupitre-Action': '1',
        'Connection': 'close',
      },
      body: JSON.stringify({ data: {} }),
    })
    assert.equal(resourceResult.status, 200, await resourceResult.text())
    assert.equal(resourceFieldActionRuns, 1)
    const textAction = resourcePage.page.spec.elements['f.title']?.props.suffixAction as
      { url: string; enabled: boolean } | undefined
    assert.equal(textAction?.url, '/admin/posts/actions/text-suffix-action')
    const textResult = await fetch(new URL(textAction!.url, fixture.baseUrl), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Pupitre-Action': '1',
        'Connection': 'close',
      },
      body: JSON.stringify({ data: {} }),
    })
    assert.equal(textResult.status, 200, await textResult.text())
    assert.equal(textSuffixActionRuns, 1)

    const record = await Post.create({
      title: 'Text action record',
      slug: `text-action-${Date.now()}`,
      status: 'draft',
      tenantId: 1,
    })
    const editPage = await inertiaPage(fixture.baseUrl, `/admin/posts/${record.id}/edit`)
    const editTextAction = editPage.page.spec.elements['f.title']?.props.suffixAction as
      { url: string; enabled: boolean } | undefined
    assert.equal(editTextAction?.url, `/admin/posts/${record.id}/actions/text-suffix-action`)

    const page = await inertiaPage(fixture.baseUrl, '/admin/action-select')
    const pageAction = page.page.spec.elements['f.status']?.props.suffixAction as
      { url: string; enabled: boolean } | undefined
    assert.deepEqual(pageAction, {
      name: 'page-field-action',
      label: 'page-field-action',
      kind: 'direct',
      url: '/admin/action-select/actions/page-field-action',
      method: 'post',
      enabled: true,
    })
    const pageResult = await fetch(new URL(pageAction!.url, fixture.baseUrl), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Pupitre-Action': '1',
        'Connection': 'close',
      },
      body: JSON.stringify({ data: {} }),
    })
    assert.equal(pageResult.status, 200, await pageResult.text())
    assert.equal(pageFieldActionRuns, 1)
  })

  test('snapshots dynamic select specs without preloading all options', async ({ assert }) => {
    await truncate()
    const category = await Category.create({ name: 'Option selected', tenantId: 1 })
    const post = await Post.create({
      title: 'Selected option',
      slug: 'selected-option',
      status: 'draft',
      categoryId: category.id,
      tenantId: 1,
    })
    const create = await inertiaPage(fixture.baseUrl, '/admin/posts/create')
    const createProps = create.page.spec.elements['f.categoryId']?.props
    const preloadedProps = create.page.spec.elements['f.preloadedCategoryId']?.props
    assert.equal(create.response.status, 200)
    assert.equal(createProps?.optionsUrl, '/admin/_pupitre/options/posts/categoryId')
    assert.deepEqual(createProps?.options, [])
    assert.equal(createProps?.preload, false)
    assert.equal(
      optionsResponse.parse({ options: preloadedProps?.options, hasMore: false }).options.length,
      1
    )

    const edit = await inertiaPage(fixture.baseUrl, `/admin/posts/${post.id}/edit`)
    const editProps = edit.page.spec.elements['f.categoryId']?.props
    assert.equal(edit.response.status, 200)
    const selectedOptions = optionsResponse.parse({
      options: editProps?.options,
      hasMore: false,
    }).options
    assert.lengthOf(selectedOptions, 1)
    assert.equal(selectedOptions[0]?.label, 'Option selected')
    assert
      .snapshot({
        optionsUrl: editProps?.optionsUrl,
        optionLabels: selectedOptions.map((option) => option.label),
        searchable: editProps?.searchable,
        preload: editProps?.preload,
      })
      .match()
  })

  test('requires related-resource viewAny for option endpoints and preloaded fields', async ({
    assert,
  }) => {
    denyRelatedViewAny = true
    try {
      const endpoint = await fetch(
        `${fixture.baseUrl}/admin/_pupitre/options/posts/categoryId?q=`,
        { headers: { Accept: 'application/json', Connection: 'close' } }
      )
      assert.equal(endpoint.status, 403)
      const page = await fetch(`${fixture.baseUrl}/admin/posts/create`, {
        headers: {
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'Referer': '/admin/posts/create',
          'Connection': 'close',
        },
        redirect: 'manual',
      })
      assert.equal(page.status, 302, await page.text())
    } finally {
      denyRelatedViewAny = false
    }
  })

  test('applies relationship and related-resource tenant scopes', async ({ assert }) => {
    await truncate()
    await seed({
      categories: [
        { name: 'Option visible', tenantId: 1 },
        { name: 'Option other tenant', tenantId: 2 },
        { name: 'Hidden by relationship scope', tenantId: 1 },
      ],
    })
    const response = await fetch(`${fixture.baseUrl}/admin/_pupitre/options/posts/categoryId?q=`, {
      headers: { Accept: 'application/json', Connection: 'close' },
    })
    const body = optionsResponse.parse(await response.json())
    assert.equal(response.status, 200)
    assert.deepEqual(
      body.options.map((option) => option.label),
      ['Option visible']
    )
  })

  test('returns the create-option form and creates a related option', async ({ assert }) => {
    await truncate()
    const url = `${fixture.baseUrl}/admin/_pupitre/options/posts/categoryId`
    const form = await fetch(`${url}?create=1`, {
      headers: { Accept: 'application/json', Connection: 'close' },
    })
    assert.equal(form.status, 200)
    actionFormResponse.parse(await form.json())

    const invalid = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Connection': 'close',
      },
      body: JSON.stringify({ data: {} }),
    })
    assert.equal(invalid.status, 422)
    const invalidBody = z
      .object({ errors: z.record(z.string(), z.array(z.string())) })
      .parse(await invalid.json())
    assert.property(invalidBody.errors, 'name')
    const created = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Connection': 'close',
      },
      body: JSON.stringify({ data: { name: 'Option created' } }),
    })
    const result = z
      .object({
        option: z.object({
          value: z.union([z.string(), z.number()]),
          label: z.string(),
        }),
      })
      .parse(await created.json())
    assert.equal(created.status, 200)
    assert.equal(result.option.label, 'Option created')
    assert.isNotNull(await Category.query().where('name', 'Option created').first())
  })

  test('denies create-option requests when related model create is denied', async ({ assert }) => {
    await truncate()
    denyRelatedCreate = true
    const url = `${fixture.baseUrl}/admin/_pupitre/options/posts/categoryId`
    const response = await fetch(`${url}?create=1`, {
      headers: { Accept: 'application/json', Connection: 'close' },
    })
    const post = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Connection': 'close',
      },
      body: JSON.stringify({ data: { name: 'Denied option' } }),
    })
    assert.equal(response.status, 403)
    assert.equal(post.status, 403)
    assert.isNull(await Category.query().where('name', 'Denied option').first())
    denyRelatedCreate = false
  })

  test('rejects submitted ids outside relationship scope and missing ids', async ({ assert }) => {
    await truncate()
    const categories = await seed({
      categories: [
        { name: 'Not an option', tenantId: 1 },
        { name: 'Option allowed', tenantId: 1 },
      ],
    })
    const outsideId = categories.categories[0]!.id
    const post = await Post.create({
      title: 'Existing relationship',
      slug: 'existing-relationship',
      status: 'draft',
      categoryId: categories.categories[1]!.id,
      tenantId: 1,
    })
    for (const categoryId of [outsideId, 99999]) {
      const response = await fetch(`${fixture.baseUrl}/admin/posts`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Pupitre-Action': '1',
          'Connection': 'close',
        },
        body: JSON.stringify({
          title: 'Invalid relation',
          slug: `invalid-relation-${categoryId}`,
          categoryId,
        }),
      })
      assert.equal(response.status, 422)
      const body = z
        .object({ errors: z.record(z.string(), z.unknown()) })
        .parse(await response.json())
      assert.property(body.errors, 'categoryId')

      const update = await fetch(`${fixture.baseUrl}/admin/posts/${post.id}`, {
        method: 'PUT',
        redirect: 'manual',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Pupitre-Action': '1',
          'Connection': 'close',
        },
        body: JSON.stringify({
          title: 'Invalid relationship update',
          slug: 'invalid-relationship-update',
          categoryId,
        }),
      })
      assert.equal(update.status, 422)
      const updateBody = z
        .object({ errors: z.record(z.string(), z.unknown()) })
        .parse(await update.json())
      assert.property(updateBody.errors, 'categoryId')
    }
  })
  test('returns 404 for unknown resources and fields', async ({ assert }) => {
    const resource = await fetch(`${fixture.baseUrl}/admin/_pupitre/options/unknown/categoryId`)
    const field = await fetch(`${fixture.baseUrl}/admin/_pupitre/options/posts/unknown`)
    assert.equal(resource.status, 404)
    assert.equal(field.status, 404)
  })
})
