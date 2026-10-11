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
      for (const content of [
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
        '<!doctype html><script>alert(1)</script>',
      ]) {
        const active = await upload(
          fixture.baseUrl,
          uploadFields(),
          Buffer.from(content),
          'spoofed.png',
          'image/png'
        )
        assert.equal(active.status, 422)
      }
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

  test('rejects uploads at the session cap without evicting existing ownership', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      let cookie = ''
      const keys: string[] = []
      for (let index = 0; index < 50; index += 1) {
        const response = await upload(
          fixture.baseUrl,
          uploadFields(),
          png,
          `cover-${index}.png`,
          'image/png',
          cookie
        )
        assert.equal(response.status, 200, JSON.stringify(response.body))
        cookie = response.cookie
        keys.push(response.body.key as string)
      }

      const rejected = await upload(
        fixture.baseUrl,
        uploadFields(),
        png,
        'overflow.png',
        'image/png',
        cookie
      )
      assert.equal(rejected.status, 429)
      assert.include(rejected.body.message as string, 'Upload session limit reached')
      assert.isTrue(await storedFile(fixture.storagePath, keys[0]!))

      const removed = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': cookie,
        },
        body: JSON.stringify({ key: keys[0] }),
      })
      assert.equal(removed.status, 204)
      assert.isFalse(await storedFile(fixture.storagePath, keys[0]!))
    } finally {
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
  test('prunes rich-editor attachment ownership when its field is saved', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      const post = await Post.create({
        title: 'Rich editor upload',
        slug: `rich-editor-${Date.now()}`,
        status: 'draft',
        tenantId: 1,
      })
      const attachment = await upload(
        fixture.baseUrl,
        uploadFields('body', 'posts', { record: String(post.id) })
      )
      assert.equal(attachment.status, 200, JSON.stringify(attachment.body))
      const key = attachment.body.key as string
      const saved = await fetch(`${fixture.baseUrl}/admin/posts/${post.id}`, {
        method: 'PUT',
        redirect: 'manual',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': attachment.cookie,
          'X-Pupitre-Action': '1',
        },
        body: JSON.stringify({
          title: post.title,
          slug: post.slug,
          status: 'draft',
          body: `<p><img src="${attachment.body.url}"></p>`,
        }),
      })
      assert.equal(saved.status, 200, await saved.text())
      const ownershipCheck = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': attachment.cookie,
        },
        body: JSON.stringify({ key }),
      })
      assert.equal(ownershipCheck.status, 403)
      assert.isTrue(await storedFile(fixture.storagePath, key))
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('prunes only consumed repeater uploads and cleans up files when a row attachment is replaced', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const first = await Post.create({
        title: 'First repeater upload',
        slug: `repeater-a-${Date.now()}`,
        status: 'draft',
        tenantId: 1,
      })
      const second = await Post.create({
        title: 'Second repeater upload',
        slug: `repeater-b-${Date.now()}`,
        status: 'draft',
        tenantId: 1,
      })
      const firstUpload = await upload(
        fixture.baseUrl,
        uploadFields('items.attachment', 'posts', { record: String(first.id) })
      )
      const oldSecondUpload = await upload(
        fixture.baseUrl,
        uploadFields('items.attachment', 'posts', { record: String(second.id) }),
        png,
        'old-attachment.png',
        'image/png',
        firstUpload.cookie
      )
      assert.equal(oldSecondUpload.status, 200, JSON.stringify(oldSecondUpload.body))
      let cookie = oldSecondUpload.cookie
      const save = async (post: Post, attachment: string, title: string) => {
        const response = await fetch(`${fixture.baseUrl}/admin/posts/${post.id}`, {
          method: 'PUT',
          redirect: 'manual',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cookie': cookie,
            'X-Pupitre-Action': '1',
          },
          body: JSON.stringify({
            title,
            slug: post.slug,
            status: 'draft',
            items: [{ attachment }],
          }),
        })
        const nextCookie = response.headers.getSetCookie()[0]?.split(';', 1)[0]
        if (nextCookie) cookie = nextCookie
        return response
      }
      const firstKey = firstUpload.body.key as string
      const oldSecondKey = oldSecondUpload.body.key as string
      const savedFirst = await save(first, firstKey, first.title)
      assert.equal(savedFirst.status, 200, await savedFirst.text())
      const savedSecond = await save(second, oldSecondKey, second.title)
      assert.equal(savedSecond.status, 200, await savedSecond.text())
      const savedSecondRecord = await Post.findOrFail(second.id)
      assert.equal(savedSecondRecord.items?.[0]?.attachment, oldSecondKey)

      const replacement = await upload(
        fixture.baseUrl,
        uploadFields('items.attachment', 'posts', { record: String(second.id) }),
        png,
        'replacement-attachment.png',
        'image/png',
        cookie
      )
      assert.equal(replacement.status, 200, JSON.stringify(replacement.body))
      const replaced = await save(second, replacement.body.key as string, 'Replaced attachment')
      assert.equal(replaced.status, 200, await replaced.text())
      assert.isFalse(await storedFile(fixture.storagePath, oldSecondKey))
      assert.isTrue(await storedFile(fixture.storagePath, replacement.body.key as string))

      const resaved = await save(second, replacement.body.key as string, 'Saved again')
      assert.equal(resaved.status, 200, await resaved.text())
      const resavedRecord = await Post.findOrFail(second.id)
      assert.equal(resavedRecord.title, 'Saved again')
    } finally {
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
