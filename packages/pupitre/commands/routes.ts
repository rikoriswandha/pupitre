import { BaseCommand } from '@adonisjs/core/ace'

interface PupitrePanel {
  id: string
  path: string
}

interface PupitreManager {
  panels: PupitrePanel[]
}

interface RouteInfo {
  methods: string[]
  pattern: string
  name?: string
}

function isPanelRoute(route: RouteInfo, panelPath: string) {
  return route.pattern === panelPath || route.pattern.startsWith(`${panelPath}/`)
}

export default class PupitreRoutesCommand extends BaseCommand {
  static commandName = 'pupitre:routes'
  static description = 'List routes registered by Pupitre, grouped by panel'
  static options = { startApp: true }

  async run() {
    const [serviceModule, { default: router }] = await Promise.all([
      import('../services/main.js'),
      import('@adonisjs/core/services/router'),
    ])
    const service = serviceModule as unknown as { default: PupitreManager }
    const routes = router.toJSON() as Record<string, RouteInfo[]>
    const flatRoutes = Object.values(routes).flat()

    for (const panel of service.default.panels) {
      this.logger.info(panel.id)
      const panelRoutes = flatRoutes.filter((route) => isPanelRoute(route, panel.path))
      for (const route of panelRoutes) {
        this.logger.info(
          `${route.methods.join('|')} ${route.pattern} ${route.name ?? ''}`.trimEnd()
        )
      }
    }
  }
}
