import { test } from '@japa/runner'
import { defineWidget } from '../../../src/builder/widget.js'
import PupitreManager from '../../../src/manager.js'
import type { PanelDefinition } from '../../../src/definition/panel.js'
import type { WidgetDefinition } from '../../../src/definition/widget.js'

test('resolves widget builders from lazy barrel imports and direct entries', async ({ assert }) => {
  const importedBuilder = defineWidget('imported').heading('Imported widget')
  const directBuilder = defineWidget('direct').heading('Direct widget')
  const manager = new PupitreManager({} as never)
  const widgets = await (
    manager as unknown as {
      resolveWidgets(panel: PanelDefinition): Promise<WidgetDefinition[]>
    }
  ).resolveWidgets({
    id: 'admin',
    widgets: [async () => ({ default: importedBuilder }), directBuilder, async () => directBuilder],
  } as unknown as PanelDefinition)

  assert.deepEqual(
    widgets.map((widget) => widget.name),
    ['imported', 'direct', 'direct']
  )
  assert.equal(widgets.find((widget) => widget.name === 'imported')?.heading, 'Imported widget')
})

test('resolves a discovered widget registry object', async ({ assert }) => {
  const widget = defineWidget('dashboard-health').heading('Dashboard health')
  const manager = new PupitreManager({} as never)
  const widgets = await (
    manager as unknown as {
      resolveWidgets(panel: PanelDefinition): Promise<WidgetDefinition[]>
    }
  ).resolveWidgets({
    id: 'admin',
    widgets: { dashboardHealth: async () => ({ default: widget }) },
  } as unknown as PanelDefinition)
  assert.deepEqual(
    widgets.map((item) => item.name),
    ['dashboard-health']
  )
  assert.equal(widgets[0]?.heading, 'Dashboard health')
})
