import { test } from '@japa/runner'
import { schema } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixturePanel,
  fixturePostResource,
} from '../../helpers/app.js'

const panels = {
  admin: async () => ({
    default: fixturePanel.resources({
      posts: fixturePostResource.form((fields) =>
        fields.components([
          schema
            .builder('content')
            .blocks([schema.block('hero').schema([schema.fileUpload('image')])]),
          schema.fileUpload('image').image().maxSize(1),
        ])
      ),
    }),
  }),
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=',
  'base64'
)

test.group('Builder upload path collision', () => {
  test('bare top-level names cannot resolve to less restrictive builder fields', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ panels })
    try {
      const upload = (field: string) => {
        const form = new FormData()
        form.append('resource', 'posts')
        form.append('field', field)
        form.append('file', new Blob([png], { type: 'image/png' }), 'image.png')
        return fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: form,
        })
      }
      const topLevel = await upload('image')
      assert.equal(topLevel.status, 413, await topLevel.clone().text())
      const block = await upload('content.hero.data.image')
      assert.equal(block.status, 200, await block.clone().text())
    } finally {
      await closeTestApp(fixture)
    }
  })
})
