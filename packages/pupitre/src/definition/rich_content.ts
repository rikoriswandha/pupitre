import type { HttpContext } from '@adonisjs/core/http'
import type { BlockSchemaNamespace, SchemaNodeBuilder, SchemaNodeDefinition } from './schema.js'

export type MentionOption = { id: string | number; label: string }
export type MentionProviderDefinition = {
  char: string
  options?: readonly MentionOption[]
  search?: (
    query: string,
    ctx: HttpContext
  ) => readonly MentionOption[] | Promise<readonly MentionOption[]>
}
export type RichBlockDefinition = {
  id: string
  label: string
  icon?: string
  schema: SchemaNodeDefinition[]
  toHtml?: (args: { config: Record<string, unknown> }) => string
  rawHtml?: boolean
}
export type RichContentOptions = {
  mergeTags?: Record<string, string | number>
  blocks?: readonly (RichBlockDefinition | { toDefinition(): RichBlockDefinition })[]
}
export interface MentionProviderBuilder {
  toDefinition(): MentionProviderDefinition
  options(options: readonly MentionOption[]): MentionProviderBuilder
  search(callback: NonNullable<MentionProviderDefinition['search']>): MentionProviderBuilder
}
export interface RichBlockBuilder {
  toDefinition(): RichBlockDefinition
  label(label: string): RichBlockBuilder
  icon(icon: string): RichBlockBuilder
  schema(callback: (fields: BlockSchemaNamespace) => readonly SchemaNodeBuilder[]): RichBlockBuilder
  toHtml(callback: NonNullable<RichBlockDefinition['toHtml']>): RichBlockBuilder
  /** Explicit HTML opt-in. Output is still sanitized. */
  rawHtml(value?: boolean): RichBlockBuilder
}
