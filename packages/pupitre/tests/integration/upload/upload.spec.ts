import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { uploadResponse } from '../../../catalog/wire.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  Post,
} from '../../helpers/app.js'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=',
  'base64'
)

type UploadResult = { status: number; body: Record<string, unknown>; cookie: string }

async function upload(
  baseUrl: string,
  fields: Record<string, string>,
  bytes = png,
  name = 'cover.png',
  type = 'image/png',
  cookie = ''
): Promise<UploadResult> {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append('file', new Blob([bytes], { type }), name)
  const response = await fetch(`${baseUrl}/admin/_pupitre/upload`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: form,
  })
  const text = await response.text()
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text) as Record<string, unknown>
  } catch {
    body = { message: text }
  }
  return {
    status: response.status,
    body,
    cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? cookie,
  }
}

function uploadFields(field = 'cover', resource = 'posts', extra: Record<string, string> = {}) {
  return { resource, field, ...extra }
}

async function storedFile(storagePath: string, key: string): Promise<boolean> {
  try {
    await stat(join(storagePath, key))
    return true
  } catch {
    return false
  }
}

test.group('Pupitre upload HTTP runtime', () => {
  test('stores a sniffed PNG beneath its field directory and returns a catalog-valid URL', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const response = await upload(fixture.baseUrl, uploadFields())
      assert.equal(response.status, 200, JSON.stringify(response.body))
      assert.isTrue(uploadResponse.safeParse(response.body).success)
      const key = response.body.key as string
      assert.match(key, /^posts\/cover\/[\w-]+\.png$/)
      assert.isTrue(await storedFile(fixture.storagePath, key))
      assert.isString(response.body.url)
      const served = await fetch(new URL(response.body.url as string, fixture.baseUrl))
      assert.equal(served.status, 200)
      assert.deepEqual(Buffer.from(await served.arrayBuffer()), png)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('rejects executable bytes, oversize files, and unknown or non-upload fields without storage', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const executable = await upload(
        fixture.baseUrl,
        uploadFields(),
        Buffer.from('MZ\x90\0'),
        'evil.png'
      )
      assert.equal(executable.status, 422)
      const oversized = await upload(
        fixture.baseUrl,
        uploadFields(),
        Buffer.alloc(2 * 1024 * 1024 + 1),
        'large.png'
      )
      assert.equal(oversized.status, 413)
      const unknownResource = await upload(fixture.baseUrl, uploadFields('cover', 'missing'))
      assert.equal(unknownResource.status, 404)
      const unknownField = await upload(fixture.baseUrl, uploadFields('missing'))
      assert.equal(unknownField.status, 404)
      const nonUploadField = await upload(fixture.baseUrl, uploadFields('title'))
      assert.equal(nonUploadField.status, 404)
      const files = await readdir(fixture.storagePath)
      assert.deepEqual(files, [])
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('enforces create authorization and same-session ownership for deletion', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      denyPolicyAbility('create')
      const denied = await upload(fixture.baseUrl, uploadFields())
      assert.equal(denied.status, 403)
      allowPolicyAbilities()

      const uploaded = await upload(fixture.baseUrl, uploadFields())
      assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body))
      const key = uploaded.body.key as string
      const notOwned = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': uploaded.cookie,
        },
        body: JSON.stringify({ key: 'posts/another-session.png' }),
      })
      assert.equal(notOwned.status, 403)
      assert.isTrue(await storedFile(fixture.storagePath, key))

      const removed = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': uploaded.cookie,
        },
        body: JSON.stringify({ key }),
      })
      assert.equal(removed.status, 204)
      assert.isFalse(await storedFile(fixture.storagePath, key))
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('denies update uploads and removes replaced files only after a successful record update', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const post = await Post.create({
        title: 'Upload replacement',
        slug: `upload-${Date.now()}`,
        status: 'draft',
        tenantId: 1,
      })
      assert.isTrue(
        Boolean(await Post.find(post.id)),
        `Created upload test record ${post.id} must be queryable`
      )
      denyPolicyAbility('update')
      const deniedUpdate = await upload(
        fixture.baseUrl,
        uploadFields('cover', 'posts', { record: String(post.id) })
      )
      assert.equal(deniedUpdate.status, 403, JSON.stringify(deniedUpdate.body))
      allowPolicyAbilities()

      const record = String(post.id)
      const first = await upload(fixture.baseUrl, uploadFields('cover', 'posts', { record }))
      assert.equal(first.status, 200, JSON.stringify(first.body))
      const firstKey = first.body.key as string
      const assigned = await fetch(`${fixture.baseUrl}/admin/posts/${post.id}`, {
        method: 'PUT',
        redirect: 'manual',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': first.cookie,
        },
        body: JSON.stringify({
          title: post.title,
          slug: post.slug,
          status: post.status,
          cover: firstKey,
        }),
      })
      assert.equal(assigned.status, 302, await assigned.text())
      const second = await upload(
        fixture.baseUrl,
        uploadFields('cover', 'posts', { record }),
        png,
        'replacement.png',
        'image/png',
        first.cookie
      )
      assert.equal(second.status, 200, JSON.stringify(second.body))
      const secondKey = second.body.key as string
      const updated = await fetch(`${fixture.baseUrl}/admin/posts/${post.id}`, {
        method: 'PUT',
        redirect: 'manual',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': second.cookie,
          'X-Pupitre-Action': '1',
        },
        body: JSON.stringify({
          title: post.title,
          slug: post.slug,
          status: post.status,
          cover: secondKey,
          body: '<p>Rich editor content</p>',
        }),
      })
      assert.equal(updated.status, 200, await updated.text())
      const persisted = await Post.findOrFail(post.id)
      assert.equal(persisted.cover, secondKey)
      assert.isFalse(await storedFile(fixture.storagePath, firstKey))
      assert.isTrue(await storedFile(fixture.storagePath, secondKey))
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('resolves image URLs in list cells and image entries', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      const uploaded = await upload(fixture.baseUrl, uploadFields())
      assert.equal(uploaded.status, 200)
      const key = uploaded.body.key as string
      await Post.create({
        title: 'Resolved image record',
        slug: `resolved-image-${Date.now()}`,
        status: 'draft',
        cover: key,
        tenantId: 1,
      })
      const headers = {
        'Accept': 'text/html, application/xhtml+xml',
        'X-Inertia': 'true',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia-Version': '1',
      }
      const listResponse = await fetch(`${fixture.baseUrl}/admin/posts?q=Resolved%20image`, {
        headers,
      })
      const list = (await listResponse.json()) as {
        props: { data: { rows: { cells: Record<string, unknown> }[] } }
      }
      assert.equal(listResponse.status, 200)
      assert.equal(list.props.data.rows[0]?.cells.cover, uploaded.body.url)

      const record = await Post.query().where('cover', key).firstOrFail()
      const viewResponse = await fetch(`${fixture.baseUrl}/admin/posts/${record.id}`, { headers })
      const view = (await viewResponse.json()) as {
        props: {
          page: {
            spec: { elements: Record<string, { type: string; props: Record<string, unknown> }> }
          }
        }
      }
      assert.equal(viewResponse.status, 200)
      assert.equal(view.props.page.spec.elements['f.cover']?.type, 'ImageEntry')
      assert.equal(view.props.page.spec.elements['f.cover']?.props.value, uploaded.body.url)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('returns signed URLs for private upload fields and resolves repeater upload paths', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const publicUpload = await upload(fixture.baseUrl, uploadFields())
      const privateUpload = await upload(
        fixture.baseUrl,
        uploadFields('privateCover'),
        png,
        'private.png',
        'image/png',
        publicUpload.cookie
      )
      assert.equal(privateUpload.status, 200, JSON.stringify(privateUpload.body))
      assert.notEqual(privateUpload.body.url, publicUpload.body.url)
      assert.include(privateUpload.body.url as string, 'signature=')
      assert.isTrue(await storedFile(fixture.storagePath, privateUpload.body.key as string))

      const nested = await upload(
        fixture.baseUrl,
        uploadFields('items.attachment'),
        png,
        'attachment.png',
        'image/png',
        privateUpload.cookie
      )
      assert.equal(nested.status, 200, JSON.stringify(nested.body))
      assert.match(nested.body.key as string, /^posts\/items\/attachment\/[\w-]+\.png$/)
      assert.isTrue(await storedFile(fixture.storagePath, nested.body.key as string))
    } finally {
      await closeTestApp(fixture)
    }
  })
})
