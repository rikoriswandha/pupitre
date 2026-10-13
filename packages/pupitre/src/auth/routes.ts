import ImpersonationController from './impersonation.js'
import type { HttpRouterService } from '@adonisjs/core/types'
import type { PanelRuntime } from '../manager.js'
import type PupitreManager from '../manager.js'
import type { PanelRouteGroups } from '../http/router.js'
import AuthController from './controller.js'
import SocialAuthController from './social_controller.js'
import SessionsController from './sessions_controller.js'
/** Registers only the auth routes enabled for this panel. */
export function registerAuthRoutes(
  router: HttpRouterService,
  panel: PanelRuntime,
  groups: PanelRouteGroups,
  _manager: PupitreManager
): void {
  if (!panel.auth.login) return
  groups.guest(() => {
    if (panel.social?.providers.length) {
      router
        .get('/auth/:provider/redirect', [SocialAuthController, 'redirect'])
        .as('auth.social.redirect')
      router
        .get('/auth/:provider/callback', [SocialAuthController, 'callback'])
        .as('auth.social.callback')
    }
    router.get('/login', [AuthController, 'loginPage']).as('auth.login')
    router.post('/login', [AuthController, 'login']).as('auth.login.store')
    if (panel.auth.mfa) {
      router.get('/mfa/challenge', [AuthController, 'mfaChallenge']).as('auth.mfa.challenge')
      router.post('/mfa/challenge', [AuthController, 'completeMfaChallenge']).as('auth.mfa.verify')
    }
    if (panel.auth.passkeys?.enabled) {
      router
        .get('/passkeys/login/options', [AuthController, 'passkeyLoginOptions'])
        .as('auth.passkeys.login.options')
      router
        .post('/passkeys/login/verify', [AuthController, 'passkeyLoginVerify'])
        .as('auth.passkeys.login.verify')
    }
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
    if (panel.impersonation) {
      router
        .post('/impersonation/leave', [ImpersonationController, 'leave'])
        .as('impersonation.leave')
    }
    router.post('/logout', [AuthController, 'logout']).as('auth.logout')
    if (panel.sessions) {
      if (!panel.auth.profile?.enabled && !panel.auth.mfa && !panel.auth.passkeys?.enabled) {
        router.get('/profile', [AuthController, 'profile']).as('profile')
        router.put('/profile', [AuthController, 'updateProfile']).as('profile.update')
      }
      router.get('/profile/sessions', [SessionsController, 'index']).as('profile.sessions')
      router
        .delete('/profile/sessions/:id', [SessionsController, 'revoke'])
        .as('profile.sessions.revoke')
      router
        .post('/profile/sessions/logout-others', [SessionsController, 'revokeOthers'])
        .as('profile.sessions.others')
      router
        .post('/profile/sessions/passkey-options', [SessionsController, 'options'])
        .as('profile.sessions.passkeyOptions')
    }
    if (panel.auth.emailVerification) {
      router
        .get('/email/verify', [AuthController, 'verificationNotice'])
        .as('auth.verification.notice')
      router
        .post('/email/verification-notification', [AuthController, 'sendVerification'])
        .as('auth.verification.send')
    }
    const hasSecurityPage = panel.auth.mfa || panel.auth.passkeys?.enabled
    if (panel.auth.profile?.enabled || hasSecurityPage) {
      router.get('/profile', [AuthController, 'profile']).as('profile')
      router.put('/profile', [AuthController, 'updateProfile']).as('profile.update')
      if (panel.auth.profile.avatar) {
        router.post('/profile/avatar', [AuthController, 'uploadAvatar']).as('profile.avatar.upload')
        router
          .delete('/profile/avatar', [AuthController, 'deleteAvatar'])
          .as('profile.avatar.delete')
      }
      if (panel.auth.mfa) {
        router.post('/profile/mfa/setup', [AuthController, 'mfaSetup']).as('profile.mfa.setup')
        router
          .post('/profile/mfa/confirm', [AuthController, 'mfaConfirm'])
          .as('profile.mfa.confirm')
        router
          .post('/profile/mfa/disable', [AuthController, 'mfaDisable'])
          .as('profile.mfa.disable')
        router
          .post('/profile/mfa/recovery-codes', [AuthController, 'regenerateMfaRecoveryCodes'])
          .as('profile.mfa.recovery-codes')
      }
      if (panel.auth.passkeys?.enabled) {
        router.get('/profile/passkeys', [AuthController, 'listPasskeys']).as('profile.passkeys')
        router
          .post('/profile/passkeys/register/options', [AuthController, 'passkeyRegisterOptions'])
          .as('profile.passkeys.register.options')
        router
          .post('/profile/passkeys/register/verify', [AuthController, 'passkeyRegisterVerify'])
          .as('profile.passkeys.register.verify')
        router
          .patch('/profile/passkeys/:id', [AuthController, 'renamePasskey'])
          .as('profile.passkeys.rename')
        router
          .delete('/profile/passkeys/:id', [AuthController, 'deletePasskey'])
          .as('profile.passkeys.delete')
      }
    }
  })
}
