import type { HttpContext } from '@adonisjs/core/http'
import { GithubDriver } from '@adonisjs/ally/drivers/github'
import type { InferSocialProviders } from '@adonisjs/ally/types'
import { defineConfig, services } from '@adonisjs/ally'

const fakeProvider = (ctx: HttpContext) => {
  const driver = new GithubDriver(ctx, {
    clientId: 'fake',
    clientSecret: 'fake',
    callbackUrl: `${appUrl}/admin/auth/fake/callback`,
  })
  driver.redirect = async () => {
    ctx.response
      .redirect()
      .withQs(false)
      .toPath('/admin/auth/fake/callback?email=admin%40example.com&id=admin&verified=true')
  }
  driver.accessDenied = () => ctx.request.input('status') === 'denied'
  driver.stateMisMatch = () => ctx.request.input('status') === 'mismatch'
  driver.hasError = () => ctx.request.input('status') === 'error'
  driver.user = async () => ({
    id: String(ctx.request.input('id', 'admin')),
    nickName: 'demo-admin',
    name: 'Demo Admin',
    email: String(ctx.request.input('email', 'admin@example.com')),
    emailVerificationState:
      ctx.request.input('verified', 'true') === 'true' ? 'verified' : 'unverified',
    avatarUrl: null,
    token: { token: 'fake', type: 'bearer', scope: '' },
    original: {},
  })
  return driver
}

const appUrl = process.env.APP_URL ?? 'http://localhost:3333'
const allyConfig = defineConfig({
  github: services.github({
    clientId: process.env.GITHUB_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    callbackUrl: `${appUrl}/admin/auth/github/callback`,
  }),
  google: services.google({
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: `${appUrl}/admin/auth/google/callback`,
  }),
  ...(process.env.PUPITRE_FAKE_ALLY === 'true' ? { fake: fakeProvider } : {}),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
