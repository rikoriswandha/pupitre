import { test } from '@japa/runner'
import { configProvider } from '@adonisjs/core'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { defineConfig, definePanel, PupitreManager } from '@rikology/pupitre'
import type { PupitreConfig } from '@rikology/pupitre'
import { __camelName__ } from '../index.js'

test('applies {{name}} to a panel', async ({ assert }) => {
  const app = new IgnitorFactory()
    .withCoreConfig()
    .withCoreProviders()
    .create(new URL('../', import.meta.url))
    .createApp('web')
  await app.init()
  await app.boot()
  try {
    const config = await configProvider.resolve<PupitreConfig>(app, defineConfig())
    if (!config) throw new Error('Pupitre config did not resolve')
    app.container.bindValue('pupitre.config', config)
    const manager = new PupitreManager(app)
    await manager.boot([
      definePanel('admin').plugins([
        __camelName__({ documentationUrl: 'https://example.com/docs' }),
      ]),
    ])
    const panel = manager.getPanel('admin')!
    const group = panel.pluginNavigation?.[0]
    if (!group || group.type !== 'group') throw new Error('Plugin navigation group missing')
    assert.equal(group.label, 'Plugins')
    assert.deepInclude(group.items[0], {
      label: '{{name}} documentation',
      url: 'https://example.com/docs',
      external: true,
    })
  } finally {
    await app.terminate()
  }
})
