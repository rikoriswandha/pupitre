import { test } from '@japa/runner'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { schema } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixturePanel,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=',
  'base64'
)
const panels = {
  admin: async () => ({
    default: fixturePanel.resources({
      posts: fixturePostResource.form((fields) =>
        fields.components([
          schema.text('title').required(),
          schema.text('slug').required(),
          schema
            .builder('content')
            .blocks([schema.block('hero').schema([schema.fileUpload('image')])]),
        ])
      ),
    }),
  }),
}

function cookies(response: Response, previous = '') {
  const pairs = new Map(
    previous
      .split('; ')
      .filter(Boolean)
      .map((pair) => [pair.split('=', 1)[0], pair])
  )
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0]
    pairs.set(pair.split('=', 1)[0], pair)
  }
  return [...pairs.values()].join('; ')
}

test.group('Builder upload lifecycle', () => {
  test('saves full-path uploads, prunes consumed ownership, preserves persisted keys and deletes replaced files', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ panels })
    try {
      const post = await Post.create({
        title: 'Builder upload',
        slug: 'builder-upload',
        status: 'draft',
        tenantId: 1,
      })
      let cookie = ''
      const upload = async () => {
        const form = new FormData()
        form.append('resource', 'posts')
        form.append('field', 'content.hero.data.image')
        form.append('record', String(post.id))
        form.append('file', new Blob([png], { type: 'image/png' }), 'hero.png')
        const response = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
          method: 'POST',
          headers: { Accept: 'application/json', Cookie: cookie },
          body: form,
        })
        cookie = cookies(response, cookie)
        assert.equal(response.status, 200, await response.clone().text())
        const body = await response.json()
        if (!body || typeof body !== 'object' || !('key' in body) || typeof body.key !== 'string')
          throw new Error('Expected an uploaded file key')
        return body.key
      }
      const save = async (image: string) => {
        const response = await fetch(`${fixture.baseUrl}/admin/posts/${post.id}`, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cookie': cookie,
            'X-Pupitre-Action': '1',
          },
          body: JSON.stringify({
            title: post.title,
            slug: post.slug,
            content: [{ type: 'hero', data: { image } }],
          }),
        })
        cookie = cookies(response, cookie)
        assert.equal(response.status, 200, await response.clone().text())
      }
      const first = await upload()
      await save(first)
      const ownership = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': cookie,
        },
        body: JSON.stringify({ key: first }),
      })
      assert.equal(ownership.status, 403)
      await save(first)
      const second = await upload()
      await save(second)
      await post.refresh()
      assert.deepEqual(post.content, [{ type: 'hero', data: { image: second } }])
      await assert.rejects(() => stat(join(fixture.storagePath, first)))
      const stored = await stat(join(fixture.storagePath, second))
      assert.isTrue(stored.isFile())
    } finally {
      await closeTestApp(fixture)
    }
  })
})
