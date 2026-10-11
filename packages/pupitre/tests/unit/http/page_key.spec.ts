import type { HttpContext } from '@adonisjs/core/http'
import { test } from '@japa/runner'
import { pageKey } from '../../../src/http/page_props.js'

test('page keys change when the current tenant changes', ({ assert }) => {
  const context = {
    pupitre: {
      panel: { id: 'admin' },
      tenant: { id: 10 },
    },
  }
  const ctx = context as unknown as HttpContext
  const first = pageKey(ctx, 'posts', 'edit', 4)
  context.pupitre.tenant.id = 20
  assert.equal(first, 'admin:posts:edit:4:10')
  assert.equal(pageKey(ctx, 'posts', 'edit', 4), 'admin:posts:edit:4:20')
})
