import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { assertHidden, runAction, submitForm, visitResource } from '@rikology/pupitre/testing'
import Category from '#models/category'
import Post from '#models/post'
import Tenant from '#models/tenant'
import User from '#models/user'

test.group('Pupitre testing helpers with example resources', () => {
  test('maps invalid create errors, runs publish, and evaluates field visibility', async ({
    assert,
  }) => {
    const user = await User.updateOrCreate(
      { email: 'admin@example.com' },
      { fullName: 'Testing Admin', password: 'password' }
    )
    const tenant = await Tenant.updateOrCreate({ slug: 'acme' }, { name: 'Acme', slug: 'acme' })
    const category = await Category.create({
      name: `Testing ${Date.now()}`,
      slug: `testing-${Date.now()}`,
      tenantId: tenant.id,
    })
    const post = await Post.create({
      title: 'Testing helper draft',
      slug: `testing-helper-${Date.now()}`,
      status: 'draft',
      categoryId: category.id,
      authorId: user.id,
      tenantId: tenant.id,
      isFeatured: false,
      viewsCount: 0,
    })

    const invalid = await submitForm(
      'posts',
      'create',
      {
        slug: `testing-helper-invalid-${Date.now()}`,
        categoryId: category.id,
        status: 'draft',
      },
      { user }
    )
    assert.equal(invalid.status, 422)
    invalid.assertErrors({ title: 'must be defined' })

    const edit = await visitResource('posts', 'edit', { user, record: post })
    const publishedAt = Object.entries(edit.spec.elements).find(
      ([, element]) => element.props.name === 'publishedAt'
    )
    if (!publishedAt) throw new Error('Expected the edit spec to contain the publishedAt field')
    assertHidden(edit.spec, edit.state, publishedAt[0])

    await runAction('posts', 'publish', {
      user,
      record: post,
      data: { publishedAt: DateTime.utc().toISO(), notify: false },
    })
    await post.refresh()
    assert.equal(post.status, 'published')
  })
})
