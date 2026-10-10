import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pupitreTest, expect } from './fixtures/pupitre_test.js'

type ManifestChunk = {
  file: string
  src?: string
  name?: string
  imports?: string[]
  dynamicImports?: string[]
}

type Manifest = Record<string, ManifestChunk>

pupitreTest('the inertia entry keeps TipTap code in dynamically imported chunks', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(import.meta.dirname, '../public/assets/.vite/manifest.json'), 'utf8')
  ) as Manifest
  const entry = manifest['inertia/app.tsx']
  expect(entry?.file).toBeTruthy()

  const traverse = (roots: string[], followDynamic: boolean) => {
    const visited = new Set<string>()
    const pending = [...roots]
    while (pending.length > 0) {
      const key = pending.pop()!
      if (visited.has(key) || !manifest[key]) continue
      visited.add(key)
      pending.push(...(manifest[key].imports ?? []))
      if (followDynamic) pending.push(...(manifest[key].dynamicImports ?? []))
    }
    return visited
  }

  const staticEntry = traverse(entry.imports ?? [], false)
  const dynamicEntry = traverse(entry.dynamicImports ?? [], true)
  const tiptapChunks = Object.entries(manifest)
    .filter(([key, chunk]) => `${key} ${chunk.src ?? ''} ${chunk.name ?? ''}`.includes('@tiptap/'))
    .map(([key]) => key)

  expect(tiptapChunks.length).toBeGreaterThan(0)
  for (const key of tiptapChunks) {
    expect(staticEntry.has(key), `${key} must not be statically imported by inertia/app.tsx`).toBe(
      false
    )
    expect(dynamicEntry.has(key), `${key} must be reachable only through a dynamic import`).toBe(
      true
    )
  }
})
