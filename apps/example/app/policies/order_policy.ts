import type User from '#models/user'

export default class OrderPolicy {
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
  /** Custom ability used by the `refund` row action via `.can('refund')`. */
  refund(user: User) {
    return this.isAdmin(user)
  }
}
