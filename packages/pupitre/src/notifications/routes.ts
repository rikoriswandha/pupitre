import type { HttpRouterService } from '@adonisjs/core/types'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import NotificationController from './controller.js'

/** Registers inbox/read endpoints inside the panel's tenant route group. */
export function registerNotificationRoutes(
  router: HttpRouterService,
  _panel: PanelRuntime,
  _manager: PupitreManager
): void {
  const controller = new NotificationController()
  router.get('/_pupitre/notifications', controller.index).as('notifications')
  router.post('/_pupitre/notifications/read', controller.read).as('notifications.read')
}
