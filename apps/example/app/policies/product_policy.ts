import type User from '#models/user'

export default class ProductPolicy {
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
  replicate(_user: User) {
    return true
  }
  delete(user: User) {
    return this.isAdmin(user)
  }
  /** Custom ability used by the `archive` row and bulk actions via `.can('archive')`. */
  archive(user: User) {
    return this.isAdmin(user)
  }
}
