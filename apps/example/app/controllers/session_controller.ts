import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import { createHash } from 'node:crypto'
import { consumeLoginLimit } from '@rikology/pupitre/drivers/limiter'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  async store({ request, auth, response, session }: HttpContext) {
    // IP-wide quota counts successful sign-ins too, so it must tolerate shared IPs.
    const key = createHash('sha256').update(`example:login:${request.ip()}`).digest('hex')
    if (await consumeLoginLimit(key, 60)) {
      const message = 'Too many login attempts. Try again in one minute.'
      response.header('Retry-After', '60')
      if (request.header('x-inertia') || request.accepts(['json', 'html']) === 'html') {
        session.flash('inputErrorsBag', { email: message })
        return response.redirect().back()
      }
      return response.status(429).json({ message })
    }
    const { email, password } = await request.validateUsing(loginValidator)
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(user)
    response.redirect().toRoute('dashboard')
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create')
  }
}
