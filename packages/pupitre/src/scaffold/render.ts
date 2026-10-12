import { kebab, pluralize } from '../definition/shared.js'
import type { ResourceField, ResourceRelation } from './introspect.js'

export type ResourceScaffold = {
  modelName: string
  modelImport: string
  fields: ResourceField[]
  belongsTo?: ResourceRelation[]
}

function title(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
}

function enumOptions(values: readonly string[]): string {
  return JSON.stringify(Object.fromEntries(values.map((value) => [value, title(value)])))
}

function fieldKind(field: ResourceField): string {
  if (field.enum) return `schema.select('${field.name}').options(${enumOptions(field.enum)})`
  if (/email/i.test(field.name)) return `schema.email('${field.name}')`
  if (field.type === 'boolean') return `schema.toggle('${field.name}')`
  if (field.type === 'number') return `schema.number('${field.name}')`
  if (field.type === 'dateTime') return `schema.dateTime('${field.name}')`
  if (field.type === 'date') return `schema.date('${field.name}')`
  if (field.type === 'json') return `schema.keyValue('${field.name}')`
  return `schema.text('${field.name}')`
}

function tableKind(field: ResourceField): string {
  const searchable = field.type === 'string' && !field.enum ? '.searchable()' : ''
  if (field.enum)
    return `table.badge('${field.name}').label('${title(field.name)}').options(${enumOptions(field.enum)}).sortable()`
  if (field.type === 'boolean')
    return `table.icon('${field.name}').boolean().label('${title(field.name)}')`
  const date = field.type === 'dateTime' ? '.dateTime()' : field.type === 'date' ? '.date()' : ''
  const numeric = field.type === 'number' ? '.numeric()' : ''
  const sortable = field.type === 'json' ? '' : '.sortable()'
  return `table.text('${field.name}').label('${title(field.name)}')${searchable}${numeric}${sortable}${date}`
}

function infolistKind(field: ResourceField): string {
  if (field.enum)
    return `schema.badgeEntry('${field.name}').label('${title(field.name)}').options(${enumOptions(field.enum)})`
  if (field.type === 'boolean')
    return `schema.iconEntry('${field.name}').label('${title(field.name)}').boolean()`
  const date = field.type === 'dateTime' ? '.dateTime()' : field.type === 'date' ? '.date()' : ''
  return `schema.textEntry('${field.name}').label('${title(field.name)}')${date}`
}

export function renderResource(input: ResourceScaffold): string {
  const modelName = input.modelName.replace(/Model$/, '')
  const fields = input.fields.filter(
    (field) =>
      !field.primary &&
      !/password/i.test(field.name) &&
      !/^(createdAt|updatedAt|deletedAt|created_at|updated_at|deleted_at)$/i.test(field.name)
  )
  const relations = input.belongsTo ?? []
  const foreignKeys = new Set(relations.map((relation) => relation.foreignKey).filter(Boolean))
  const formFields = fields
    .filter((field) => !foreignKeys.has(field.name))
    .map((field) => `      ${fieldKind(field)},`)
  const relationFields = relations.map((relation) => {
    const foreignKey = relation.foreignKey ?? `${relation.name}Id`
    const relatedColumns = relation.relatedModel?.$columnsDefinitions
    const relatedTitle = relatedColumns?.has('title')
      ? 'title'
      : relatedColumns?.has('name')
        ? 'name'
        : 'id'
    return `      schema.select('${foreignKey}').relationship('${relation.name}', '${relatedTitle}'),`
  })
  const tableFields = fields
    .filter((field) => !foreignKeys.has(field.name))
    .map((field) => `      ${tableKind(field)},`)
  const relationColumns = relations.map((relation) => {
    const relatedColumns = relation.relatedModel?.$columnsDefinitions
    const relatedTitle = relatedColumns?.has('title')
      ? 'title'
      : relatedColumns?.has('name')
        ? 'name'
        : 'id'
    const path = `${relation.name}.${relatedTitle}`
    return `      table.text('${path}').label('${title(relation.name)}').sortable(),`
  })
  const entries = fields.map((field) => `      ${infolistKind(field)},`)
  const slug = pluralize(kebab(modelName))
  return `import { actions, defineResource, pages, schema, table } from '@rikology/pupitre'
import ${modelName} from '${input.modelImport}'

export default defineResource(${modelName})
  .slug('${slug}')
  .label('${modelName}')
  .pluralLabel('${pluralize(modelName)}')
  .recordTitle('${fields.find((field) => /title|name/i.test(field.name))?.name ?? fields[0]?.name ?? 'id'}')
  .form(() => [
${[...formFields, ...relationFields].join('\n')}
  ])
  .table((t) => t.columns([
${[...tableFields, ...relationColumns].join('\n')}
  ]))
  .infolist(() => [
${entries.join('\n')}
  ])
  .actions({
    header: [actions.create()],
    row: [actions.edit(), actions.view(), actions.delete()],
  })
  .pages({
    list: pages.list(),
    create: pages.create(),
    edit: pages.edit(),
    view: pages.view(),
  })
`
}
