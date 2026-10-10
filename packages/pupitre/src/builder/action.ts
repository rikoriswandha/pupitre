import { E_PUPITRE_INVALID_ACTION_NAME } from '../errors.js'
import type { ActionBuilder, ActionDefinition, ActionColor } from '../definition/action.js'
import type { SchemaNodeBuilder } from '../definition/schema.js'

class Action implements ActionBuilder {
  constructor(readonly definition: ActionDefinition) {}
  private set(patch: Partial<ActionDefinition>): this {
    return new Action({ ...this.definition, ...patch }) as this
  }
  private setConfirmation(
    key: keyof NonNullable<ActionDefinition['confirmation']>,
    value: unknown
  ): this {
    return this.set({ confirmation: { ...this.definition.confirmation, [key]: value } })
  }
  private setModal(key: keyof NonNullable<ActionDefinition['modal']>, value: unknown): this {
    return this.set({ modal: { ...this.definition.modal, [key]: value } })
  }
  label(value: string): this {
    return this.set({ label: value })
  }
  icon(value: string): this {
    return this.set({ icon: value })
  }
  color(value: ActionColor): this {
    return this.set({ color: value })
  }
  variant(value: 'button' | 'link' | 'iconButton'): this {
    return this.set({ variant: value })
  }
  visible(value: NonNullable<ActionDefinition['visible']>): this {
    return this.set({ visible: value })
  }
  can(value: string): this {
    return this.set({ can: value })
  }
  requiresConfirmation(value = true): this {
    return this.set({ confirmation: value ? { ...this.definition.confirmation } : undefined })
  }
  modalHeading(value: string): this {
    return this.setModal('heading', value)
  }
  modalDescription(value: string): this {
    return this.setModal('description', value)
  }
  modalWidth(value: NonNullable<NonNullable<ActionDefinition['modal']>['width']>): this {
    return this.setModal('width', value)
  }
  slideOver(value = true): this {
    return this.setModal('slideOver', value)
  }
  modalSubmitLabel(value: string): this {
    return this.setModal('submitLabel', value)
  }
  modalCancelLabel(value: string): this {
    return this.setModal('cancelLabel', value)
  }
  modalIcon(value: string): this {
    return this.setModal('icon', value)
  }
  form(value: readonly SchemaNodeBuilder[]): this {
    return this.set({ form: value.map((field) => field.toDefinition()) })
  }
  fillForm(value: NonNullable<ActionDefinition['fillForm']>): this {
    return this.set({ fillForm: value })
  }
  handle(value: NonNullable<ActionDefinition['handle']>): this {
    return this.set({ handle: value })
  }
  after(value: NonNullable<ActionDefinition['after']>): this {
    return this.set({ after: value })
  }
  url(value: NonNullable<ActionDefinition['url']>): this {
    return this.set({ url: value })
  }
  openUrlInNewTab(value = true): this {
    return this.set({ openUrlInNewTab: value })
  }
  keyBindings(value: readonly string[]): this {
    return this.set({ keyBindings: value })
  }
  group(value: string): this {
    return this.set({ group: value })
  }
  deselectAfter(value = true): this {
    return this.set({ deselectAfter: value })
  }
  destructive(value = true): this {
    return this.setConfirmation('destructive', value)
  }
}
function create(name: string, kind: ActionDefinition['kind'] = 'action'): ActionBuilder {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) throw new E_PUPITRE_INVALID_ACTION_NAME()
  const builtin = kind === 'action' ? undefined : kind
  const context = kind === 'bulk' ? 'bulk' : kind === 'create' ? 'header' : 'record'
  const confirmation = kind === 'delete' ? { destructive: true } : undefined
  return new Action({ name, kind, builtin, context, confirmation })
}
export function action(name: string): ActionBuilder {
  return create(name)
}
export const actions = {
  create: (name = 'create') => create(name, 'create'),
  edit: (name = 'edit') => create(name, 'edit'),
  view: (name = 'view') => create(name, 'view'),
  delete: (name = 'delete') => create(name, 'delete'),
  bulk: (name: string) => create(name, 'bulk'),
}
