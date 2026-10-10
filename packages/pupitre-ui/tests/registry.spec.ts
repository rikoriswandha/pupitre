import { test } from '@japa/runner'
import { assertRegistryComplete, pupitreCatalog } from '@rikology/pupitre/catalog'
import { components } from '../src/components.js'

const shellNames = ['Shell', 'Toaster', 'Modal', 'ConfirmDialog', 'NotFound']
const catalogComponents = Object.fromEntries(
  Object.entries(components).filter(([name]) => name in pupitreCatalog.components)
)

test.group('Pupitre UI registry', () => {
  test('implements every catalog component and registers each shell component', ({ assert }) => {
    assertRegistryComplete(pupitreCatalog, catalogComponents)
    for (const name of shellNames) assert.include(Object.keys(components), name)
  })
})
