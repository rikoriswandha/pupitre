import type User from '#models/user'

export default class UserPolicy {
  private isAdmin(user: User) {
    return user.email === 'admin@example.com'
  }

  viewAny(_user: User) {
    return true
  }
  view(_user: User) {
    return true
  }
  create(_user: User) {
    return true
  }
  update(_user: User) {
    return true
  }
  delete(user: User) {
    return this.isAdmin(user)
  }
  restore(user: User) {
    return this.isAdmin(user)
  }
  forceDelete(user: User) {
    return this.isAdmin(user)
  }
}
