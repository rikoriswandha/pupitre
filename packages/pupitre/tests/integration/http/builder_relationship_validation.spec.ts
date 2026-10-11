import { test } from '@japa/runner'
import { schema } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixturePanel,
  fixturePostResource,
  Category,
  Post,
  denyCategoryPolicyAbility,
  allowPolicyAbilities,
  fixtureCategoryResource,
} from '../../helpers/app.js'

const panels = {
  admin: async () => ({
    default: fixturePanel.resources({
      posts: fixturePostResource.form((fields) =>
        fields.components([
          schema.text('title').required(),
          schema.text('slug').required(),
          schema
            .builder('content')
            .blocks([
              schema
                .block('hero')
                .schema([schema.select('categoryId').relationship('category', 'name').required()]),
            ]),
        ])
      ),
      categories: fixtureCategoryResource,
    }),
  }),
}

test.group('Builder relationship validation', () => {
  test('saves authorized related values and rejects missing or denied values at full error paths', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ panels })
    try {
      const category = await Category.create({ name: 'Builder category' })
      const submit = (slug: string, categoryId: number) =>
        fetch(`${fixture.baseUrl}/admin/posts`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Pupitre-Action': '1',
          },
          body: JSON.stringify({
            title: 'Builder relation',
            slug,
            content: [{ type: 'hero', data: { categoryId } }],
          }),
        })
      const accepted = await submit('builder-authorized', category.id)
      assert.equal(accepted.status, 200, await accepted.clone().text())
      const row = await Post.query().where('slug', 'builder-authorized').firstOrFail()
      assert.deepEqual(row.content, [{ type: 'hero', data: { categoryId: category.id } }])
      const missing = await submit('builder-missing', 999999)
      assert.equal(missing.status, 422)
      const missingBody = await missing.json()
      if (!missingBody || typeof missingBody !== 'object' || !('errors' in missingBody))
        throw new Error('Expected missing relationship validation errors')
      if (!missingBody.errors || typeof missingBody.errors !== 'object')
        throw new Error('Expected a validation error map')
      assert.isTrue(Object.hasOwn(missingBody.errors, 'content.0.data.categoryId'))
      denyCategoryPolicyAbility('view')
      const denied = await submit('builder-denied', category.id)
      assert.equal(denied.status, 422)
      const deniedBody = await denied.json()
      if (!deniedBody || typeof deniedBody !== 'object' || !('errors' in deniedBody))
        throw new Error('Expected denied relationship validation errors')
      if (!deniedBody.errors || typeof deniedBody.errors !== 'object')
        throw new Error('Expected a validation error map')
      assert.isTrue(Object.hasOwn(deniedBody.errors, 'content.0.data.categoryId'))
      assert.isNull(await Post.query().where('slug', 'builder-denied').first())
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
})
