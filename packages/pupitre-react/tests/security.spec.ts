import { test } from '@japa/runner'
import { deleteUpload, jsonFetch, setFetch, uploadFile } from '../src/bridge/actions.js'

test('all mutating fetch methods include XSRF, including Request inputs and multipart bodies', async ({
  assert,
  cleanup,
}) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie: 'other=1; XSRF-TOKEN=encrypted%2Btoken' },
  })
  cleanup(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  const requests: RequestInit[] = []
  cleanup(
    setFetch(async (_input, init) => {
      requests.push(init ?? {})
      return new Response(null, { status: 204 })
    })
  )
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    await jsonFetch('/mutation', { method, body: '{}' })
    await jsonFetch(
      new Request('http://localhost/mutation', { method, headers: { 'X-Test': 'retained' } })
    )
    const form = new FormData()
    form.append('file', new Blob(['csv']), 'test.csv')
    await jsonFetch('/upload', { method, body: form })
  }
  const descriptor = {
    name: 'cover',
    uploadUrl: '/upload',
    deleteUrl: '/upload',
    multiple: false,
    image: true,
    reorderable: false,
    downloadable: true,
    previewable: true,
  }
  await uploadFile(descriptor, new File(['png'], 'cover.png'), 'admin:posts:create::acme')
  await deleteUpload(descriptor, 'cover.png', 'admin:posts:edit:1:acme')
  for (const init of requests) {
    assert.equal(new Headers(init.headers).get('X-XSRF-TOKEN'), 'encrypted+token')
    assert.equal(init.credentials, 'same-origin')
    if (init.body instanceof FormData) assert.isFalse(new Headers(init.headers).has('Content-Type'))
  }
  assert.equal(new Headers(requests[1].headers).get('X-Test'), 'retained')
  await jsonFetch('/mutation', { method: 'POST', headers: { 'x-xsrf-token': 'explicit' } })
  assert.equal(new Headers(requests.at(-1)!.headers).get('X-XSRF-TOKEN'), 'explicit')
})
