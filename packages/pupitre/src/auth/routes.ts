import type { HttpRouterService } from '@adonisjs/core/types'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import type { PanelRouteGroups } from '../http/router.js'
import AuthController from './controller.js'

/** Registers only the auth routes enabled for this panel. */
export function registerAuthRoutes(
  router: HttpRouterService,
  panel: PanelRuntime,
  groups: PanelRouteGroups,
  _manager: PupitreManager
): void {
  if (!panel.auth.login) return
  groups.guest(() => {
    router.get('/login', [AuthController, 'loginPage']).as('auth.login')
    router.post('/login', [AuthController, 'login']).as('auth.login.store')
    if (panel.auth.passwordReset) {
      router.get('/password/forgot', [AuthController, 'forgotPage']).as('auth.password.request')
      router.post('/password/email', [AuthController, 'forgot']).as('auth.password.email')
      router.get('/password/reset/:token', [AuthController, 'resetPage']).as('auth.password.reset')
      router
        .post('/password/reset/:token', [AuthController, 'updatePassword'])
        .as('auth.password.update')
    }
    if (panel.auth.registration) {
      router.get('/register', [AuthController, 'registerPage']).as('auth.register')
      router.post('/register', [AuthController, 'register']).as('auth.register.store')
    }
    if (panel.auth.emailVerification) {
      router
        .get('/email/verify/:id/:hash', [AuthController, 'verifyEmail'])
        .as('auth.verification.verify')
    }
  })
  groups.user(() => {
    router.post('/logout', [AuthController, 'logout']).as('auth.logout')
    if (panel.auth.emailVerification) {
      router
        .get('/email/verify', [AuthController, 'verificationNotice'])
        .as('auth.verification.notice')
      router
        .post('/email/verification-notification', [AuthController, 'sendVerification'])
        .as('auth.verification.send')
    }
    if (panel.auth.profile?.enabled) {
      router.get('/profile', [AuthController, 'profile']).as('profile')
      router.put('/profile', [AuthController, 'updateProfile']).as('profile.update')
      if (panel.auth.profile.avatar) {
        router.post('/profile/avatar', [AuthController, 'uploadAvatar']).as('profile.avatar.upload')
        router
          .delete('/profile/avatar', [AuthController, 'deleteAvatar'])
          .as('profile.avatar.delete')
      }
    }
  })
}
