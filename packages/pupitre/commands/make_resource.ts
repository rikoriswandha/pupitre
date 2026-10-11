import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  applyDeclaredTypes,
  introspectModel,
  parseMigration,
  tableFromModel,
} from '../src/scaffold/introspect.js'
import type { MigrationColumn } from '../src/scaffold/introspect.js'
import { renderResource } from '../src/scaffold/render.js'
import { kebab } from '../src/definition/shared.js'
import { writeResourceFile } from '../src/scaffold/write_resource.js'

export default class MakeResourceCommand extends BaseCommand {
  static commandName = 'make:resource'
  static description = 'Generate a Pupitre resource from a Lucid model'
  static options = { startApp: true as const }

  @args.string({ description: 'Lucid model name' })
  declare name: string

  @flags.string({ description: 'Model module path (defaults to #models/<model>)' })
  declare model: string | undefined

  @flags.boolean({ description: 'Use the model table migration for columns' })
  declare fromMigration: boolean

  @flags.boolean({ description: 'Overwrite an existing resource file' })
  declare force: boolean

  async run() {
    const className = this.name.replace(/[^A-Za-z0-9_$]/g, '')
    if (!className) {
      this.logger.error('Provide a valid model class name.')
      this.exitCode = 1
      return
    }

    const modelImport = this.model ?? `#models/${kebab(className)}`
    const module = await this.app.import(modelImport)
    const model = module.default
    if (!model || typeof model !== 'function') {
      this.logger.error(`The module ${modelImport} must have a default Lucid model export.`)
      this.exitCode = 1
      return
    }

    model.boot?.()
    const metadata = introspectModel(model)
    const tableName = tableFromModel(model)
    let fields = metadata.fields
    let belongsTo = metadata.belongsTo
    if (this.fromMigration) {
      const migrations = await readdir(this.app.migrationsPath())
      const sorted = migrations.filter((file) => file.endsWith('.ts')).sort()
      const migrationColumns: MigrationColumn[] = []
      const migrationSources: string[] = []
      for (const file of sorted) {
        const source = await readFile(join(this.app.migrationsPath(), file), 'utf8')
        migrationSources.push(source)
        const parsed = parseMigration(source, tableName)
        if (parsed.length) migrationColumns.splice(0, migrationColumns.length, ...parsed)
      }
      if (!migrationColumns.length) {
        this.logger.error(`Could not find a migration defining table "${tableName}".`)
        this.exitCode = 1
        return
      }
      const relationByColumn = new Map(
        belongsTo.map((relation) => [relation.foreignKey ?? '', relation])
      )
      for (const column of migrationColumns) {
        if (!column.foreignTable) continue
        const foreignKey = column.name.replace(/_([a-z])/g, (_match, letter: string) =>
          letter.toUpperCase()
        )
        if (relationByColumn.has(foreignKey)) continue
        const table = column.foreignTable
        const relationName = table.endsWith('ies')
          ? `${table.slice(0, -3)}y`
          : table.endsWith('s')
            ? table.slice(0, -1)
            : table
        const relatedColumns = migrationSources.flatMap((source) => parseMigration(source, table))
        relationByColumn.set(foreignKey, {
          name: relationName,
          type: 'belongsTo',
          foreignKey,
          relatedModel: {
            $columnsDefinitions: new Map(
              relatedColumns.map((relatedColumn) => [
                relatedColumn.name.replace(/_([a-z])/g, (_match, letter: string) =>
                  letter.toUpperCase()
                ),
                { columnName: relatedColumn.name },
              ])
            ),
          },
        })
      }
      belongsTo = [...relationByColumn.values()]
      fields = migrationColumns.map((column) => ({
        name: column.name.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
        type: column.type as (typeof fields)[number]['type'],
        primary: /^(id|uuid)$/i.test(column.name),
        enum: column.enum,
        foreignRelation: relationByColumn.get(
          column.name.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase())
        )?.name,
      }))
    } else {
      const modelSourcePath = this.app.modelsPath(`${kebab(model.name.replace(/Model$/, ''))}.ts`)
      const generatedSchemaPath = this.app.makePath('database/schema.ts')
      fields = await applyDeclaredTypes(fields, [modelSourcePath, generatedSchemaPath])
    }

    const outputPath = this.app.makePath('app/admin/resources', `${kebab(className)}_resource.ts`)
    const written = await writeResourceFile(
      outputPath,
      renderResource({ modelName: className, modelImport, fields, belongsTo }),
      this.force
    )
    if (!written) {
      this.logger.info(`Resource already exists: ${outputPath} (use --force to overwrite)`)
      return
    }
    if (metadata.skippedRelations.length) {
      this.logger.warning(
        `Skipped unsupported relations: ${metadata.skippedRelations.join(', ')}. Only belongsTo relations are scaffolded.`
      )
    }
    this.logger.success(`Created resource: ${outputPath}`)
  }
}
