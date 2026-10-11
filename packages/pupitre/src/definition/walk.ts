import { getComponentDefinition, schema as schemaFactory } from '../builder/schema/schema.js'

import type { SchemaNodeDefinition } from './schema.js'

type RepeaterDefinition = Extract<SchemaNodeDefinition, { kind: 'repeater' }>
export type SchemaWalkerOptions = {
  repeaterSchema?: (node: RepeaterDefinition) => SchemaNodeDefinition[]
}

/** Visit schema nodes once, including fields nested in wizard steps, builder blocks, and repeaters. */
export function walkSchema(
  nodes: readonly SchemaNodeDefinition[],
  visit: (node: SchemaNodeDefinition, path: string) => void,
  options: SchemaWalkerOptions = {},
  prefix = ''
): void {
  for (const node of nodes) {
    const path =
      'name' in node && node.name ? [prefix, node.name].filter(Boolean).join('.') : prefix
    visit(node, path)

    if (node.kind === 'wizard') {
      for (const step of node.steps) walkSchema(step.children, visit, options, prefix)
    } else if (node.kind === 'builder') {
      for (const block of node.blocks)
        walkSchema(block.schema, visit, options, `${path}.${block.name}.data`)
    } else if (node.kind === 'repeater') {
      const children =
        options.repeaterSchema?.(node) ??
        (typeof node.schema === 'function'
          ? node.schema(schemaFactory as never).map((child) => {
              const builder = child as { toDefinition?: () => SchemaNodeDefinition }
              return typeof builder.toDefinition === 'function'
                ? getComponentDefinition(builder as never)
                : (child as SchemaNodeDefinition)
            })
          : (node.schema ?? []))
      walkSchema(children, visit, options, path)
    } else if ('children' in node && Array.isArray(node.children)) {
      walkSchema(node.children, visit, options, prefix)
    }
  }
}
