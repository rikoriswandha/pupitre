import { z } from 'zod'
import { defineCatalogExtension } from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer, setFetch, useStateValue } from '@rikology/pupitre-react'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { mediaCatalog } from '@rikology/pupitre-media/catalog'
import { components } from '../../../src/components.js'
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII='
const items = [1, 2, 3].map((id) => ({
  id,
  filename: `Image ${id}`,
  alt: `Image ${id}`,
  mime: 'image/png',
  url: png,
}))
function MediaState() {
  const state = useStateValue('/data/cover')
  return <output aria-label="Selected media">{JSON.stringify(state)}</output>
}
const stateCatalog = defineCatalogExtension({
  name: 'media-state',
  components: { MediaState: { kind: 'entry', props: z.object({}), description: 'Selected IDs' } },
})
const registry = defineRegistry(
  { ...components, MediaState },
  { extensions: [mediaCatalog, stateCatalog] }
)
const panel: PupitrePageProps['pupitre'] = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
}
export function MediaStory({ lookup }: { lookup?: 'cells' | 'picker' | 'invalid' }) {
  setFetch(async (input, init) => {
    if (lookup) return fetch(input, init)
    const url = String(input)
    if (url.endsWith('/upload'))
      return Response.json({
        key: 'media/upload.png',
        name: 'uploaded.png',
        mime: 'image/png',
        size: 1,
        url: png,
      })
    if (init?.method === 'POST') return Response.json({ rows: [items[2]] }, { status: 201 })
    const query = new URL(url, 'http://localhost').searchParams
    const ids = [...query.entries()]
      .filter(([key]) => key.startsWith('ids['))
      .map(([, id]) => Number(id))
    return Response.json({
      rows: ids.length ? items.filter((item) => ids.includes(item.id)) : items,
    })
  })
  const page: PupitrePageProps['page'] = {
    key: 'media-ct',
    kind: 'custom',
    title: 'Media',
    breadcrumbs: [],
    catalogVersion: '1.0',
    actions: { header: [] },
    state: {
      data: { cover: lookup === 'picker' ? Array.from({ length: 25 }, (_, i) => i + 1) : [] },
    },
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'Group',
          props: {},
          children:
            lookup === 'cells'
              ? Array.from({ length: 25 }, (_, i) => `cell${i}`)
              : lookup === 'invalid'
                ? ['invalid']
                : ['picker', 'state'],
        },
        picker: {
          type: 'MediaPicker',
          props: {
            name: 'cover',
            label: 'Cover',
            value: { $bindState: '/data/cover' },
            multiple: true,
            maxItems: 5,
            accept: ['image/*'],
            conversion: 'thumb',
          },
        },
        state: { type: 'MediaState', props: {} },
        ...Object.fromEntries(
          Array.from({ length: 25 }, (_, i) => [
            `cell${i}`,
            { type: 'MediaColumn', props: { value: i + 1 } },
          ])
        ),
        invalid: { type: 'MediaColumn', props: { value: [-1, 0, 1] } },
      },
    },
  }
  return (
    <main className="bg-background p-6 text-foreground">
      <PupitreRenderer
        page={page}
        pupitre={panel}
        registry={registry}
        runAction={async () => {}}
        upload={async () => ({})}
        toast={() => {}}
      />
    </main>
  )
}
