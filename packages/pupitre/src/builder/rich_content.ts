import { schema } from './schema/schema.js'
import type { BlockSchemaNamespace } from '../definition/schema.js'
import type {
  MentionProviderBuilder,
  MentionProviderDefinition,
  RichBlockBuilder,
  RichBlockDefinition,
} from '../definition/rich_content.js'

export function mentionProvider(char: string): MentionProviderBuilder {
  if (!char || char.length > 8 || /\s/.test(char))
    throw new TypeError('Mention triggers must be 1–8 non-whitespace characters')
  const create = (definition: MentionProviderDefinition): MentionProviderBuilder => ({
    toDefinition: () => definition,
    options: (options) =>
      create({ char: definition.char, options: options.map((option) => ({ ...option })) }),
    search: (search) => create({ char: definition.char, search }),
  })
  return create({ char })
}
export function richBlock(id: string): RichBlockBuilder {
  if (!/^[a-zA-Z][\w-]*$/.test(id)) throw new TypeError('Invalid rich block identifier')
  const create = (definition: RichBlockDefinition): RichBlockBuilder => ({
    toDefinition: () => definition,
    label: (label) => create({ ...definition, label }),
    icon: (icon) => create({ ...definition, icon }),
    schema: (callback) =>
      create({
        ...definition,
        schema: callback(schema as unknown as BlockSchemaNamespace).map((node) =>
          node.toDefinition()
        ),
      }),
    toHtml: (toHtml) => create({ ...definition, toHtml }),
    rawHtml: (rawHtml = true) => create({ ...definition, rawHtml }),
  })
  return create({ id, label: id, schema: [] })
}
