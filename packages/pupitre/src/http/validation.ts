import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { SchemaNodeDefinition } from '../definition/schema.js'
import { compileValidator } from '../compiler/vine_compiler.js'

export function validateResourceData(
  ctx: HttpContext,
  model: LucidModel,
  nodes: SchemaNodeDefinition[],
  data: unknown,
  record?: LucidRow
): Promise<Record<string, unknown>> {
  return compileValidator(nodes).validate(data, {
    record,
    model,
    ctx,
    timezone: ctx.pupitre.timezone,
  })
}
