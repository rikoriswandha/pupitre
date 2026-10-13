import { test } from '@japa/runner'
import { shield } from '@rikology/pupitre-shield'
import { audit } from '@rikology/pupitre-audit'
import { settings, defineSettings } from '@rikology/pupitre-settings'
import { definePanel } from '../../../src/builder/panel.js'
import { buildPolicyInspection } from '../../../src/inspect/report.js'
import { closeTestApp, createTestApp, User } from '../../helpers/app.js'
import type PupitreManager from '../../../src/manager.js'

test('strict panels boot with Shield and Audit policies and Settings callbacks', async ({
  assert,
}) => {
  const group = defineSettings('strict-settings')
    .form((form) => [form.text('title')])
    .defaults({ title: 'Operations' })
  const panel = definePanel('admin')
    .strictAuthorization()
    .plugins([
      shield({ userModel: async () => ({ default: User }), resources: ['roles'] }),
      audit({ authorize: async () => true }),
      settings({ groups: [group], authorize: async () => true }),
    ])
  const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  try {
    const manager = (await fixture.app.container.make('pupitre.manager')) as PupitreManager
    const report = await buildPolicyInspection(manager.panels)
    assert.deepEqual(report.map((item) => item.resource).sort(), ['activity', 'roles'])
    assert.isTrue(
      report.every((item) => item.strictAuthorization && item.policy && !item.violations.length)
    )
    assert.isTrue(
      manager.panels[0].pages.some((page) => page.definition.slug === 'settings-strict-settings')
    )
  } finally {
    await closeTestApp(fixture)
  }
})
