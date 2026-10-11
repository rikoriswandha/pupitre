import { readFile } from 'node:fs/promises'
import { kebab, pluralize } from '../definition/shared.js'

export type ResourceField = {
  name: string
  type: 'string' | 'boolean' | 'number' | 'dateTime' | 'date' | 'json' | 'unknown'
  primary?: boolean
  enum?: string[]
  foreignRelation?: string
}

export type ResourceRelation = {
  name: string
  type: string
  foreignKey?: string
  relatedModel?: { table?: string; $columnsDefinitions?: Map<string, { columnName: string }> }
}

export type ResourceModelMetadata = {
  name: string
  table?: string
  $columnsDefinitions?: Map<
    string,
    { columnName: string; isPrimary?: boolean; meta?: { type?: string; enum?: unknown } }
  >
  $relationsDefinitions?: Map<string, ResourceRelation>
}

export type MigrationColumn = { name: string; type: string; enum?: string[]; foreignTable?: string }

function normalizeType(value: string | undefined): ResourceField['type'] {
  if (value === 'dateTime' || value === 'date') return value
  if (value === 'boolean' || value === 'number' || value === 'json') return value
  return 'string'
}

function enumValues(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return undefined
  return value
}

function relationKind(relation: ResourceRelation): string {
  return relation.type || relation.constructor?.name || ''
}

export function introspectModel(model: ResourceModelMetadata): {
  fields: ResourceField[]
  belongsTo: ResourceRelation[]
  skippedRelations: string[]
} {
  const columns = model.$columnsDefinitions ?? new Map()
  const fields = [...columns].map(([name, column]) => ({
    name,
    type: normalizeType(column.meta?.type),
    primary: column.isPrimary,
    enum: enumValues(column.meta?.enum),
  }))
  const belongsTo: ResourceRelation[] = []
  const skippedRelations: string[] = []
  for (const [name, relation] of model.$relationsDefinitions ?? []) {
    const kind = relationKind(relation)
    if (kind === 'BelongsTo' || kind.toLowerCase() === 'belongsto') {
      belongsTo.push({ ...relation, name })
    } else {
      skippedRelations.push(name)
    }
  }
  return { fields, belongsTo, skippedRelations }
}

function propertyTypes(source: string): Map<string, ResourceField['type']> {
  const properties = new Map<string, ResourceField['type']>()
  const pattern = /(?:declare\s+)?([A-Za-z_$][\w$]*)\s*[!?]?\s*:\s*([^;\n]+)/g
  for (const match of source.matchAll(pattern)) {
    const type = match[2]!.replace(/\|\s*null|\|\s*undefined/g, '').trim()
    if (type === 'string') properties.set(match[1]!, 'string')
    else if (type === 'boolean') properties.set(match[1]!, 'boolean')
    else if (type === 'number' || type === 'bigint') properties.set(match[1]!, 'number')
    else if (/^(DateTime|Date)$/.test(type))
      properties.set(match[1]!, type === 'Date' ? 'date' : 'dateTime')
    else if (/^(Record<|.*\[\]|Json|unknown)/.test(type)) properties.set(match[1]!, 'json')
  }
  return properties
}

export async function applyDeclaredTypes(
  fields: ResourceField[],
  sourcePaths: string[]
): Promise<ResourceField[]> {
  const declarations = new Map<string, ResourceField['type']>()
  for (const path of sourcePaths) {
    try {
      for (const [name, type] of propertyTypes(await readFile(path, 'utf8')))
        declarations.set(name, type)
    } catch {
      // Models may have no local source when all declarations are generated into database/schema.ts.
    }
  }
  return fields.map((field) => ({ ...field, type: declarations.get(field.name) ?? field.type }))
}

function parseOptions(source: string): string[] | undefined {
  const values = [...source.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]!)
  return values.length > 0 ? values : undefined
}

export function parseMigration(source: string, tableName: string): MigrationColumn[] {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const table = source.match(
    new RegExp(
      `(?:createTable|table)\\(['\"]${escaped}['\"],\\s*\\(\\s*table\\s*\\)\\s*=>\\s*\\{([\\s\\S]*?)\\n\\s*\\}\\)`
    )
  )?.[1]
  if (!table) return []
  const columns: MigrationColumn[] = []
  const statement =
    /table\s*\.\s*(increments|bigIncrements|string|text|boolean|integer|bigInteger|smallint|float|decimal|timestamp|dateTime|date|time|json|enu|enum)\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*(\[[^\]]*\]|\{[^}]*\}))?\s*\)([\s\S]*?)(?=\n\s*table\s*\.|$)/g
  for (const match of table.matchAll(statement)) {
    const type = match[1]!
    const name = match[2]!
    const rest = match[4] ?? ''
    const resolvedType = /increment|integer|float|decimal/i.test(type)
      ? 'number'
      : type === 'boolean'
        ? 'boolean'
        : type === 'timestamp' || type === 'dateTime'
          ? 'dateTime'
          : type === 'date'
            ? 'date'
            : type === 'json'
              ? 'json'
              : 'string'
    const referenceTable = rest.match(/\.inTable\(['"]([^'"]+)['"]\)/)?.[1]
    const enumSource =
      type === 'enu' || type === 'enum'
        ? match[3]?.startsWith('[')
          ? match[3]
          : ''
        : (rest.match(/\.(?:checkIn|check)\s*\([^)]*(\[[^\]]*\])/s)?.[1] ?? '')
    columns.push({
      name,
      type: resolvedType,
      enum: parseOptions(enumSource),
      foreignTable: referenceTable,
    })
  }
  return columns
}

export function tableFromModel(model: ResourceModelMetadata): string {
  return model.table ?? pluralize(kebab(model.name.replace(/Model$/, ''))).replace(/-/g, '_')
}
