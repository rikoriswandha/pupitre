import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import { createHash } from 'node:crypto'
import { consumeLoginLimit } from '@rikology/pupitre/drivers/limiter'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store({ request, response, auth, session }: HttpContext) {
    const key = createHash('sha256').update(`example:register:${request.ip()}`).digest('hex')
    if (await consumeLoginLimit(key)) {
      const message = 'Too many registration attempts. Try again in one minute.'
      response.header('Retry-After', '60')
      if (request.header('x-inertia') || request.accepts(['json', 'html']) === 'html') {
        session.flash('inputErrorsBag', { email: message })
        return response.redirect().back()
      }
      return response.status(429).json({ message })
    }
    const { fullName, email, password } = await request.validateUsing(signupValidator)
    const user = await User.create({ fullName, email, password })

    await auth.use('web').login(user)
    response.redirect().toRoute('dashboard')
  }
}
