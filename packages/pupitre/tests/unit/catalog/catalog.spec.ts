import { z } from 'zod'
import { test } from '@japa/runner'
import type { JsonRenderSpec } from '../../../catalog/index.js'
import { jsonRenderSpec } from '../../../catalog/index.js'
import {
  actionDescriptor,
  actionResult,
  actionFormResponse,
  assertRegistryComplete,
  catalogFixtures,
  components,
  fileUploadDescriptor,
  filterDescriptor,
  formDescriptor,
  jsonRenderExpression,
  raw,
  option,
  pageProps,
  patchResponse,
  pupitreCatalog,
  repeaterDescriptor,
  tableData,
  tableDescriptor,
  uploadResponse,
} from '../../../catalog/index.js'

test.group('catalog component contracts', () => {
  test('each component fixture validates its props and complete spec', ({ assert }) => {
    for (const name of Object.keys(catalogFixtures) as Array<keyof typeof catalogFixtures>) {
      const fixture: JsonRenderSpec = catalogFixtures[name]
      const element = fixture.elements[fixture.root]
      assert.isDefined(element, `${name} root exists`)
      assert.equal(element.type, name)
      for (const [elementId, child] of Object.entries(fixture.elements)) {
        assert.isTrue(
          components[child.type].props.safeParse(child.props).success,
          `${name} fixture element ${elementId} props validate`
        )
      }
      assert.isTrue(jsonRenderSpec.safeParse(fixture).success, `${name} fixture spec validates`)
    }
    assert.deepEqual(
      Object.keys(catalogFixtures).sort(),
      Object.keys(pupitreCatalog.components).sort()
    )
  })

  test('rejects invalid component props and unknown component types', ({ assert }) => {
    assert.isFalse(components.Text.props.safeParse({ type: 'numeric' }).success)
    assert.isFalse(components.Text.props.safeParse({ value: 42 }).success)
    assert.isFalse(
      jsonRenderSpec.safeParse({ root: 'x', elements: { x: { type: 'Missing', props: {} } } })
        .success
    )
  })
  test('dynamic props accept expressions but preserve literal output types', ({
    assert,
    expectTypeOf,
  }) => {
    expectTypeOf<z.output<typeof components.Text.props>['label']>().toEqualTypeOf<
      string | null | undefined
    >()
    assert.isTrue(
      jsonRenderExpression.safeParse({ $computed: 'concat', args: { first: 'Hi' } }).success
    )
    assert.isFalse(jsonRenderExpression.safeParse({ $computed: 'concat', args: ['Hi'] }).success)
    const rawString = raw(z.string())
    expectTypeOf<z.output<typeof rawString>>().toEqualTypeOf<string>()
    assert.deepEqual(rawString.parse({ $raw: 'hello' }), 'hello')
  })

  test('registry assertion reports missing and unknown component types', ({ assert }) => {
    assert.throws(
      () => assertRegistryComplete(pupitreCatalog, { Text: {}, Extra: {} }),
      /Missing components:.*Unknown extras: Extra/s
    )
  })
})

test.group('catalog wire schemas', () => {
  test('parses the declared protocol shapes', ({ assert }) => {
    assert.isTrue(
      actionDescriptor.safeParse({
        name: 'edit',
        label: 'Edit',
        kind: 'link',
        url: '/edit',
        enabled: true,
      }).success
    )
    assert.isTrue(
      actionFormResponse.safeParse({ spec: catalogFixtures.Text, state: {}, catalogVersion: '0.1' })
        .success
    )
    assert.isTrue(
      patchResponse.safeParse({ patch: [{ op: 'replace', path: '/data/title', value: 'Updated' }] })
        .success
    )
    assert.isTrue(
      actionResult.safeParse({
        flash: [{ type: 'success', title: 'Saved' }],
        patch: [{ op: 'replace', path: '/rows', value: [] }],
        deselect: true,
      }).success
    )
    assert.isTrue(
      tableDescriptor.safeParse(catalogFixtures.DataTable.elements.root.props.descriptor).success
    )
    assert.isTrue(
      tableData.safeParse({
        rows: [],
        meta: { total: 0, perPage: 25, currentPage: 1, lastPage: 1, from: 0, to: 0 },
        query: {},
      }).success
    )
    assert.isTrue(
      formDescriptor.safeParse({
        method: 'post',
        url: '/posts',
        submitLabel: 'Save',
        dirtyGuard: true,
      }).success
    )
    assert.isTrue(
      repeaterDescriptor.safeParse(catalogFixtures.Repeater.elements.root.props.descriptor).success
    )
    assert.isTrue(
      fileUploadDescriptor.safeParse(catalogFixtures.FileUpload.elements.root.props.descriptor)
        .success
    )
    assert.isTrue(
      uploadResponse.safeParse({ key: 'a', url: '/a', name: 'a.png', size: 10, mime: 'image/png' })
        .success
    )
    assert.isTrue(
      filterDescriptor.safeParse({ type: 'ternary', name: 'published', label: 'Published' }).success
    )
    const nestedSpec = {
      root: 'search',
      elements: { search: { type: 'Text', props: { value: { $bindState: '/data/term' } } } },
    }
    for (const spec of [nestedSpec, { $raw: nestedSpec }]) {
      const result = filterDescriptor.safeParse({
        type: 'custom',
        name: 'advanced',
        label: 'Advanced',
        form: { spec },
      })
      assert.isTrue(result.success)
      if (result.success) assert.deepEqual(result.data.form?.spec, nestedSpec)
    }
    assert.deepEqual(raw(z.object({ value: z.string() })).parse({ $raw: { value: 'ok' } }), {
      value: 'ok',
    })
    assert.isTrue(option.safeParse({ value: 'draft', label: 'Draft' }).success)
    assert.isTrue(
      pageProps.safeParse({
        pupitre: {
          panel: {
            id: 'admin',
            path: '/admin',
            brand: { name: 'Acme' },
            theme: {},
            features: {},
            logoutUrl: '/logout',
          },
          user: null,
          tenant: null,
          nav: [],
          flash: [],
          locale: 'en',
          timezone: 'UTC',
        },
        page: {
          key: 'admin:posts:list::',
          kind: 'list',
          title: 'Posts',
          breadcrumbs: [],
          spec: catalogFixtures.DataTable,
          state: {},
          actions: { header: [] },
          catalogVersion: '0.1',
        },
        data: {
          rows: [],
          meta: { total: 0, perPage: 25, currentPage: 1, lastPage: 1, from: 0, to: 0 },
          query: {},
        },
      }).success
    )
  })
  test('M1 catalog omits evaluate/fetchOptions and accepts striped table descriptors', ({
    assert,
  }) => {
    assert.notProperty(pupitreCatalog.actions, 'evaluate')
    assert.notProperty(pupitreCatalog.actions, 'fetchOptions')
    assert.isTrue(
      tableDescriptor.safeParse({
        ...catalogFixtures.DataTable.elements.root.props.descriptor,
        striped: true,
      }).success
    )
  })
})
