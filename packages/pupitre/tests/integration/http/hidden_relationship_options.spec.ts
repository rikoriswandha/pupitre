import { test } from '@japa/runner'
import { schema } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixturePanel,
  fixturePostResource,
  fixtureCategoryResource,
} from '../../helpers/app.js'

class DeniedCategoryPolicy {
  viewAny() {
    return false
  }
}

test.group('Hidden relationship options', () => {
  test('preloads options for client-reactive visibility even when initially hidden', async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      panels: {
        admin: async () => ({
          default: fixturePanel.resources([
            fixturePostResource.form(() => [
              schema.text('kind'),
              schema
                .select('categoryId')
                .options(async () => [{ label: 'Reactive option', value: '1' }])
                .preload()
                .visible(({ get }) => get('kind') === 'x'),
            ]),
          ]),
        }),
      },
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/admin/posts/create`, {
        headers: { 'Accept': 'text/html', 'X-Inertia': 'true', 'X-Inertia-Version': '1' },
      })
      assert.equal(response.status, 200, await response.clone().text())
      const body = (await response.json()) as {
        props: {
          page: {
            spec: {
              elements: Record<
                string,
                { visible?: unknown; props: { name?: string; options?: unknown[] } }
              >
            }
          }
        }
      }
      const field = Object.values(body.props.page.spec.elements).find(
        (element) => element.props.name === 'categoryId'
      )
      assert.isObject(field!.visible)
      assert.deepEqual(field!.props.options, [{ label: 'Reactive option', value: '1' }])
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('does not preload or authorize options for a statically hidden relationship field', async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      panels: {
        admin: async () => ({
          default: fixturePanel.resources([
            fixturePostResource.form(() => [
              schema
                .select('categoryId')
                .relationship('category', 'name')
                .preload()
                .visible(({ ctx }) => ctx?.request.header('x-show-options') === 'yes'),
            ]),
            fixtureCategoryResource.policy(DeniedCategoryPolicy),
          ]),
        }),
      },
    })
    try {
      const hidden = await fetch(`${fixture.baseUrl}/admin/posts/create`, {
        headers: { 'Accept': 'text/html', 'X-Inertia': 'true', 'X-Inertia-Version': '1' },
      })
      assert.equal(hidden.status, 200, await hidden.clone().text())
      const body = (await hidden.json()) as {
        props: {
          page: {
            spec: {
              elements: Record<
                string,
                { visible?: unknown; props: { name?: string; options?: unknown[] } }
              >
            }
          }
        }
      }
      const field = Object.values(body.props.page.spec.elements).find(
        (element) => element.props.name === 'categoryId'
      )
      assert.isDefined(field)
      assert.isFalse(field!.visible)
      assert.deepEqual(field!.props.options, [])
      const visible = await fetch(`${fixture.baseUrl}/admin/posts/create`, {
        redirect: 'manual',
        headers: { 'Accept': 'application/json', 'x-show-options': 'yes' },
      })
      assert.equal(visible.status, 403)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
