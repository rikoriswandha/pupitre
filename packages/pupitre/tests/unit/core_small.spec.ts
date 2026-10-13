import { test } from '@japa/runner'
import PupitreManager from '../../src/manager.js'
import { definePanel } from '../../src/builder/panel.js'
import { defineResource } from '../../src/builder/resource.js'
import { defineWidget } from '../../src/builder/widget.js'
import { environmentProps } from '../../src/http/environment.js'
import { buildPolicyInspection } from '../../src/inspect/report.js'
import { formatPolicyInspection } from '../../src/inspect/format.js'
import { widgetData } from '../../catalog/wire.js'
import { defineRelationManager } from '../../src/builder/relation_manager.js'
import { resolveConfig } from '../../src/define_config.js'

class MissingModel {
  static $getRelation() {
    return { type: 'hasMany', boot() {}, relatedModel: () => OtherModel }
  }
}
class OtherModel {
  static $getRelation() {
    return { type: 'belongsTo', boot() {}, relatedModel: () => MissingModel }
  }
}
class PresentPolicy {
  viewAny() {
    return true
  }
}

test.group('core small features', () => {
  test('strict boot reports every missing resource before router resolution', async ({
    assert,
  }) => {
    const manager = new PupitreManager({
      container: { make: async () => ({ policies: async () => ({}) }) },
    } as never)
    try {
      await manager.boot([
        definePanel('strict')
          .strictAuthorization()
          .resources([defineResource(MissingModel), defineResource(OtherModel)]),
      ])
      assert.fail('Expected strict boot to reject missing policies')
    } catch (error) {
      assert.include((error as Error).message, 'strict/missings')
      assert.include((error as Error).message, 'strict/others')
    }
  })
  test('strict boot rejects policy-less non-resource table widget models', async ({ assert }) => {
    const manager = new PupitreManager({
      container: { make: async () => ({ policies: async () => ({}) }) },
    } as never)
    await assert.rejects(
      () =>
        manager.boot([
          definePanel('strict')
            .strictAuthorization()
            .widgets([
              defineWidget('unregistered', MissingModel as never).table((builder) =>
                builder.columns([])
              ),
            ]),
        ]),
      /strict\/widgets\/unregistered \(MissingModel\)/
    )
  })

  test('strict boot includes nested and relation-manager model violations', async ({ assert }) => {
    const manager = new PupitreManager({ container: { make: async () => ({}) } } as never)
    const child = defineResource(OtherModel).parent(MissingModel, 'parent')
    const parent = defineResource(MissingModel)
      .nested([child])
      .relations([defineRelationManager(MissingModel as never, 'others').readOnly()])
    try {
      await manager.boot([definePanel('strict').strictAuthorization().resources([parent])])
      assert.fail('Expected missing policies')
    } catch (error) {
      assert.include((error as Error).message, 'strict/others')
      assert.include((error as Error).message, 'strict/missings/others')
    }
  })
  test('inspect reports strict denial and violations in JSON and text', async ({ assert }) => {
    const manager = new PupitreManager({ container: { make: async () => ({}) } } as never)
    try {
      await manager.boot([
        definePanel('strict')
          .strictAuthorization()
          .resources([defineResource(MissingModel)]),
      ])
    } catch {}
    const report = await buildPolicyInspection(manager.panels)
    assert.isTrue(report[0].strictAuthorization)
    assert.isFalse(report[0].allowByDefault)
    assert.lengthOf(report[0].violations, 1)
    assert.include(JSON.stringify(report), 'strict/missings')
    assert.isTrue(
      formatPolicyInspection(report).some((entry) =>
        entry.message.includes('Strict authorization: enabled')
      )
    )
  })
  test('explicit policies remain discoverable in strict mode', async ({ assert }) => {
    const definition = defineResource(MissingModel).policy(PresentPolicy).toDefinition()
    const panel = {
      ...definePanel('strict').strictAuthorization().toDefinition(),
      resources: [{ slug: definition.slug, definition, model: MissingModel }],
      pages: [],
      widgets: [],
    } as never
    const report = await buildPolicyInspection([panel])
    assert.deepEqual(report[0].violations, [])
  })
  test('strict inventory awaits lazy explicit and discovered policy modules', async ({
    assert,
  }) => {
    for (const explicit of [true, false]) {
      const resource = explicit
        ? defineResource(MissingModel).policy(async () => ({ default: PresentPolicy }))
        : defineResource(MissingModel)
      const definition = resource.toDefinition()
      const panel = {
        ...definePanel('strict').strictAuthorization().toDefinition(),
        resources: [{ slug: definition.slug, definition, model: MissingModel }],
        pages: [],
        widgets: [],
      } as never
      const report = await buildPolicyInspection(
        [panel],
        resolveConfig({ policies: async () => ({ MissingPolicy: { default: PresentPolicy } }) })
      )
      assert.deepEqual(report[0].violations, [])
      assert.equal(report[0].policy, 'PresentPolicy')
    }
  })
  test('environment defaults, overrides and async visibility', async ({ assert }) => {
    const ctx = {
      pupitre: { panel: definePanel('admin').environmentIndicator().toDefinition() },
    } as never
    assert.isUndefined(
      await environmentProps(ctx, { inProduction: true, nodeEnvironment: 'production' })
    )
    assert.deepEqual(
      await environmentProps(ctx, { inProduction: false, nodeEnvironment: 'development' }),
      { label: 'development', color: 'warning' }
    )
    const custom = {
      pupitre: {
        panel: definePanel('admin')
          .environmentIndicator({ visible: async () => true, label: 'Staging', color: 'info' })
          .toDefinition(),
      },
    } as never
    assert.deepEqual(
      await environmentProps(custom, { inProduction: true, nodeEnvironment: 'production' }),
      { label: 'Staging', color: 'info' }
    )
    for (const visible of [false, async () => false]) {
      const hidden = {
        pupitre: { panel: definePanel('admin').environmentIndicator({ visible }).toDefinition() },
      } as never
      assert.isUndefined(
        await environmentProps(hidden, { inProduction: false, nodeEnvironment: 'development' })
      )
    }
  })
  test('radar and scatter loaders validate their distinct data shapes', async ({ assert }) => {
    const radar = defineWidget('radar')
      .chart('radar', () => ({ labels: ['Speed'], datasets: [{ label: 'Team', data: [4] }] }))
      .toDefinition()
    const scatter = defineWidget('scatter')
      .chart('scatter', () => ({ datasets: [{ label: 'Team', data: [{ x: 1, y: 2 }] }] }))
      .toDefinition()
    assert.isTrue(
      widgetData.safeParse({ kind: 'chart', ...((await radar.load!({} as never)) as object) })
        .success
    )
    assert.isTrue(
      widgetData.safeParse({ kind: 'scatter', ...((await scatter.load!({} as never)) as object) })
        .success
    )
    assert.isFalse(
      widgetData.safeParse({ kind: 'scatter', datasets: [{ label: 'Team', data: [1] }] }).success
    )
    assert.isFalse(
      widgetData.safeParse({
        kind: 'chart',
        labels: ['Speed'],
        datasets: [{ label: 'Team', data: [{ x: 1, y: 2 }] }],
      }).success
    )
  })
})
