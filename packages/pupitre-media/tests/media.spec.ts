import { test } from '@japa/runner'
import sharp from 'sharp'
import { createPupitreStorage, compileValidator, sniffUploadMime } from '@rikology/pupitre'
import { PupitreMedia, mediaPicker } from '../index.js'
import { authorizeMedia, registerMedia, resolveMedia } from '../src/service.js'
import type { PupitreManager } from '@rikology/pupitre'
import { convertImage } from '../src/drivers/sharp.js'
import { mediaApp } from './helpers/app.js'
import { teardown } from '../../pupitre/tests/helpers/db.js'
import type { HttpContext } from '@adonisjs/core/http'

async function upload(baseUrl: string, bytes: Uint8Array, name = 'image.png') {
  const body = new FormData()
  body.set('resource', 'media')
  body.set('field', 'path')
  body.set('file', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), name)
  return fetch(`${baseUrl}/admin/_pupitre/upload`, {
    method: 'POST',
    body,
    headers: { Accept: 'application/json' },
  })
}
test.group('media library', (suite) => {
  suite.teardown(teardown)
  test('uploads through core, consumes ownership, converts, signs URLs and deletes files', async ({
    assert,
  }) => {
    const fixture = await mediaApp()
    try {
      const png = await sharp({
        create: { width: 640, height: 480, channels: 3, background: '#ff0000' },
      })
        .png()
        .toBuffer()
      const response = await upload(fixture.baseUrl, png)
      assert.equal(response.status, 200, await response.clone().text())
      const payload = (await response.json()) as { key: string }
      const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? ''
      const saved = await fetch(`${fixture.baseUrl}/admin/_pupitre/media`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': cookie,
        },
        body: JSON.stringify({ paths: [payload.key], filenames: ['original.png'] }),
      })
      assert.equal(saved.status, 201, await saved.clone().text())
      const record = await PupitreMedia.firstOrFail()
      assert.equal(record.width, 640)
      assert.equal(record.height, 480)
      assert.equal(record.filename, 'original.png')
      const storage = createPupitreStorage('uploads')
      assert.isTrue(await storage.exists(record.conversions.thumb))
      const image = await storage.getStream(record.conversions.thumb)
      const chunks = []
      for await (const chunk of image) chunks.push(chunk)
      const metadata = await sharp(Buffer.concat(chunks)).metadata()
      assert.equal(metadata.width, 320)
      assert.equal(metadata.format, 'webp')
      const forged = await fetch(`${fixture.baseUrl}/admin/_pupitre/media`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [payload.key] }),
      })
      assert.equal(forged.status, 422)
      const removed = await fetch(`${fixture.baseUrl}/admin/media/${record.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        redirect: 'manual',
      })
      assert.isBelow(removed.status, 400, await removed.text())
      assert.isFalse(await storage.exists(record.path))
      assert.isFalse(await storage.exists(record.conversions.thumb))
    } finally {
      await fixture.close()
    }
  })
  test('overlapping adoptions preserve the winning original and conversions', async ({
    assert,
  }) => {
    const fixture = await mediaApp()
    const originalCreate = PupitreMedia.create.bind(PupitreMedia)
    const descriptor = Object.getOwnPropertyDescriptor(PupitreMedia, 'create')
    const bothCreating = Promise.withResolvers<void>()
    const winnerCommitted = Promise.withResolvers<void>()
    let arrivals = 0
    const attemptedConversions: Record<string, string>[] = []
    try {
      const png = await sharp({
        create: { width: 10, height: 10, channels: 3, background: '#ff0000' },
      })
        .png()
        .toBuffer()
      const response = await upload(fixture.baseUrl, png)
      assert.equal(response.status, 200, await response.clone().text())
      const { key } = (await response.json()) as { key: string }
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ')
      // Hold both real inserts until both adoptions pass their ownership pre-check.
      Object.defineProperty(PupitreMedia, 'create', {
        configurable: true,
        value: async (values: Partial<PupitreMedia>) => {
          attemptedConversions.push(values.conversions!)
          const first = ++arrivals === 1
          if (!first) bothCreating.resolve()
          await bothCreating.promise
          if (!first) await winnerCommitted.promise
          try {
            return await originalCreate(values)
          } finally {
            if (first) winnerCommitted.resolve()
          }
        },
      })
      const adopt = () =>
        fetch(`${fixture.baseUrl}/admin/_pupitre/media`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cookie': cookie,
          },
          body: JSON.stringify({ paths: [key] }),
        })
      const responses = await Promise.all([adopt(), adopt()])
      assert.equal(arrivals, 2)
      assert.equal(responses.filter((saved) => saved.status === 201).length, 1)
      assert.equal(responses.filter((saved) => saved.status >= 400).length, 1)
      const records = await PupitreMedia.query().where('path', key)
      assert.lengthOf(records, 1)
      const storage = createPupitreStorage('uploads')
      assert.isTrue(await storage.exists(key))
      for (const converted of Object.values(records[0].conversions))
        assert.isTrue(await storage.exists(converted))
      for (const converted of Object.values(attemptedConversions[1]))
        assert.isFalse(await storage.exists(converted))
    } finally {
      if (descriptor) Object.defineProperty(PupitreMedia, 'create', descriptor)
      else Reflect.deleteProperty(PupitreMedia, 'create')
      await fixture.close()
    }
  })
  test('failed image conversion deletes the consumed original without creating media', async ({
    assert,
  }) => {
    const fixture = await mediaApp()
    try {
      const png = await sharp({
        create: { width: 10, height: 10, channels: 3, background: '#ff0000' },
      })
        .png()
        .toBuffer()
      const response = await upload(fixture.baseUrl, png, 'corrupt.png')
      assert.equal(response.status, 200, await response.clone().text())
      const { key } = (await response.json()) as { key: string }
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ')
      const storage = createPupitreStorage('uploads')
      assert.isTrue(await storage.exists(key))
      await storage.put(key, png.subarray(0, 50))
      const saved = await fetch(`${fixture.baseUrl}/admin/_pupitre/media`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': cookie,
        },
        body: JSON.stringify({ paths: [key] }),
      })
      assert.isAtLeast(saved.status, 400)
      assert.isFalse(await storage.exists(key))
      assert.isNull(await PupitreMedia.query().where('path', key).first())
    } finally {
      await fixture.close()
    }
  })
  test('without sharp originals remain available and other driver failures propagate', async ({
    assert,
  }) => {
    const bytes = Buffer.from('original')
    const result = await convertImage(bytes, { thumb: { width: 320 } }, async () => {
      throw Object.assign(new Error('missing'), { code: 'ERR_MODULE_NOT_FOUND' })
    })
    assert.deepEqual(result.files, [])
    assert.isNull(result.width)
    await assert.rejects(
      () =>
        convertImage(bytes, {}, async () => {
          throw new Error('broken native module')
        }),
      'broken native module'
    )
  })
  test('fails closed without authorization and rejects SVG and forged paths', async ({
    assert,
  }) => {
    const fixture = await mediaApp({})
    try {
      const denied = await fetch(`${fixture.baseUrl}/admin/_pupitre/media`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(denied.status, 403, await denied.text())
      const deniedUpload = await upload(fixture.baseUrl, Buffer.from('<svg></svg>'))
      assert.equal(deniedUpload.status, 403)
    } finally {
      await fixture.close()
    }
    const allowed = await mediaApp()
    try {
      const svg = await upload(
        allowed.baseUrl,
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        'bad.svg'
      )
      assert.equal(svg.status, 422)
      const forged = await fetch(`${allowed.baseUrl}/admin/_pupitre/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ paths: ['media/not-owned.png'] }),
      })
      assert.equal(forged.status, 422)
      assert.isUndefined(await sniffUploadMime(Buffer.from('<svg></svg>')))
    } finally {
      await allowed.close()
    }
  })
  test('tenant scope and record view gate protect picker, resolution and field validation', async ({
    assert,
  }) => {
    const fixture = await mediaApp({
      tenancy: true,
      authorize: (_ctx, ability, record) => ability !== 'view' || record?.alt !== 'secret',
    })
    try {
      const manager = (await fixture.app.container.make('pupitre.manager')) as PupitreManager
      const panel = manager.panels[0]
      const ctx = { pupitre: { panel, tenant: { id: 1 } } } as unknown as HttpContext
      registerMedia(panel, {
        tenancy: true,
        authorize: (_ctx, ability, record) => ability !== 'view' || record?.alt !== 'secret',
      })
      const values = {
        disk: 'uploads',
        directory: 'media',
        visibility: 'private' as const,
        filename: 'x.png',
        mime: 'image/png',
        size: 1,
        conversions: {},
      }
      const own = await PupitreMedia.create({ ...values, path: 'media/own.png', tenantId: '1' })
      const foreign = await PupitreMedia.create({
        ...values,
        path: 'media/foreign.png',
        tenantId: '2',
      })
      const secret = await PupitreMedia.create({
        ...values,
        path: 'media/secret.png',
        tenantId: '1',
        alt: 'secret',
      })
      const browse = await fetch(`${fixture.baseUrl}/admin/_pupitre/media`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(browse.status, 200, await browse.clone().text())
      const body = await browse.text()
      assert.include(body, 'media/own.png')
      assert.notInclude(body, 'media/foreign.png')
      assert.notInclude(body, 'media/secret.png')
      const resolved = await resolveMedia(ctx, own.id)
      assert.equal(resolved?.id, own.id)
      assert.isNull(await resolveMedia(ctx, foreign.id))
      assert.isNull(await resolveMedia(ctx, secret.id))
      assert.isNull(await resolveMedia(ctx, 'bad-id'))
      const validator = compileValidator([
        mediaPicker('cover').multiple().maxItems(2).toDefinition(),
      ])
      await validator.validate({ cover: [own.id] }, { ctx })
      for (const ids of [
        [foreign.id],
        [secret.id],
        [999999],
        [own.id, own.id],
        [own.id, foreign.id, secret.id],
      ])
        await assert.rejects(() => validator.validate({ cover: ids }, { ctx }))
      const missing = { pupitre: { panel } } as unknown as HttpContext
      assert.isFalse(await authorizeMedia(missing, 'viewAny'))
    } finally {
      await fixture.close()
    }
  })
})
