import { test } from '@japa/runner'
import { configProvider } from '@adonisjs/core'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { compileValidator, defineConfig, definePanel, PupitreManager, t } from '@rikology/pupitre'
import type { PupitreConfig } from '@rikology/pupitre'
import { __camelName__ as pluginUnderTest, fieldNamePlaceholder } from '../index.js'

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
    await manager.boot([definePanel('admin').plugins([pluginUnderTest()])])
    assert.isDefined(manager.getPanel('admin'))
  } finally {
    await app.terminate()
  }
})

test('validates configured integer ratings on the server', async ({ assert }) => {
  const field = fieldNamePlaceholder('score').stars(7).label(t('Rating')).required()
  const validator = compileValidator([field.toDefinition()])
  const options = { timezone: 'UTC' }
  assert.deepEqual(await validator.validate({ score: 6 }, options), { score: 6 })
  for (const score of [-1, 8, 1.5, 'not a number']) {
    await assert.rejects(() => validator.validate({ score }, options))
  }
  await assert.rejects(() => validator.validate({}, options))
  const defaultValidator = compileValidator([
    fieldNamePlaceholder('score').required().toDefinition(),
  ])
  await assert.rejects(() => defaultValidator.validate({ score: 6 }, options))
  assert.deepEqual(await defaultValidator.validate({ score: 5 }, options), { score: 5 })
})
