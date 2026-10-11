import type { NotificationAction, NotificationActionBuilder } from '../definition/action.js'

class NotificationActionDefinition implements NotificationActionBuilder {
  constructor(readonly definition: NotificationAction) {}

  url(value: string): this {
    return new NotificationActionDefinition({ ...this.definition, url: value }) as this
  }

  markAsRead(value = true): this {
    return new NotificationActionDefinition({ ...this.definition, markAsRead: value }) as this
  }
}

export function notificationAction(label: string): NotificationActionBuilder {
  return new NotificationActionDefinition({ label })
}
