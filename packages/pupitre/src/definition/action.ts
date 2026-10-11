import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { SchemaNodeDefinition } from './schema.js'
import type { SchemaNodeBuilder } from './schema.js'
export type ActionColor = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'gray'
export type ActionContextName = 'record' | 'bulk' | 'header'
export type ActionVisibilityContext = { record: unknown; ctx?: HttpContext }
export interface NotificationBuilder {
  body(value: string): this
  send(): unknown
  sendToDatabase(user?: LucidRow): Promise<void>
}
export type ActionHandleContext = {
  record?: unknown
  records?: readonly unknown[]
  data?: Record<string, unknown>
  ctx?: HttpContext
  notify?: {
    success(title: string): NotificationBuilder
    danger(title: string): NotificationBuilder
    error(title: string): NotificationBuilder
    warning(title: string): NotificationBuilder
    info(title: string): NotificationBuilder
  }
}
export type ActionAfterContext = ActionHandleContext & {
  redirect: { back(): unknown; to(url: string): unknown }
  refresh: { table(): unknown }
}
export type ActionDefinition = {
  name: string
  kind: 'action' | 'create' | 'edit' | 'view' | 'delete' | 'bulk'
  builtin?: 'create' | 'edit' | 'view' | 'delete' | 'bulk'
  context: ActionContextName
  label?: string
  icon?: string
  color?: ActionColor
  variant?: 'button' | 'link' | 'iconButton'
  visible?: (args: ActionVisibilityContext) => boolean
  can?: string
  confirmation?: {
    heading?: string
    description?: string
    submitLabel?: string
    cancelLabel?: string
    icon?: string
    destructive?: boolean
  }
  modal?: {
    heading?: string
    description?: string
    width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
    slideOver?: boolean
    submitLabel?: string
    cancelLabel?: string
    icon?: string
  }
  form?: readonly SchemaNodeDefinition[]
  fillForm?: (args: {
    record: unknown
    ctx?: HttpContext
  }) => Record<string, unknown> | Promise<Record<string, unknown>>
  handle?: (args: ActionHandleContext) => unknown | Promise<unknown>
  after?: (args: ActionAfterContext) => unknown | Promise<unknown>
  url?: string | ((args: { record: unknown; ctx?: HttpContext }) => string)
  openUrlInNewTab?: boolean
  keyBindings?: readonly string[]
  group?: string
  deselectAfter?: boolean
}
export interface ActionBuilder {
  readonly definition: ActionDefinition
  label(value: string): this
  icon(value: string): this
  color(value: ActionColor): this
  variant(value: 'button' | 'link' | 'iconButton'): this
  visible(value: (args: ActionVisibilityContext) => boolean): this
  can(value: string): this
  requiresConfirmation(value?: boolean): this
  modalHeading(value: string): this
  modalDescription(value: string): this
  modalWidth(value: NonNullable<NonNullable<ActionDefinition['modal']>['width']>): this
  slideOver(value?: boolean): this
  modalSubmitLabel(value: string): this
  modalCancelLabel(value: string): this
  modalIcon(value: string): this
  form(value: readonly SchemaNodeBuilder[]): this
  fillForm(value: NonNullable<ActionDefinition['fillForm']>): this
  handle(value: NonNullable<ActionDefinition['handle']>): this
  after(value: NonNullable<ActionDefinition['after']>): this
  url(value: NonNullable<ActionDefinition['url']>): this
  openUrlInNewTab(value?: boolean): this
  keyBindings(value: readonly string[]): this
  group(value: string): this
  deselectAfter(value?: boolean): this
  destructive(value?: boolean): this
}
export type ResourceActions = {
  header?: readonly ActionBuilder[]
  row?: readonly ActionBuilder[]
  bulk?: readonly ActionBuilder[]
}
