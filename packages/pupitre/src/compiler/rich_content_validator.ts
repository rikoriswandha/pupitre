import type { FieldContext } from '@vinejs/vine/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { RichEditorFieldDefinition } from '../definition/schema.js'
import { sanitizeHtml } from '../sanitize.js'
import { compileValidator } from './vine_compiler.js'
import { replaceRichNodes } from '../rich_nodes.js'
import type { RichNode } from '../rich_nodes.js'
import { escapeRichText } from '../rich_content.js'

export async function validateRichEditor(
  value: string,
  definition: RichEditorFieldDefinition,
  field: FieldContext
): Promise<void> {
  const nodes: RichNode[] = []
  const clean = sanitizeHtml(value, {
    richNode: (node) => {
      nodes.push(node)
    },
    invalidBlock: () => field.report('The block data is invalid', 'richBlock', field),
  })
  const meta = field.meta as { ctx?: HttpContext; timezone?: string }
  const results = new Map<
    RichNode,
    { tagName: string; attribs: Record<string, string>; text?: string } | null
  >()
  let blockIndex = 0
  for (const node of nodes) {
    if (node.type === 'mention') {
      const provider = definition.mentions?.find(
        (candidate) => candidate.char === node.attributes['data-char']
      )
      const choices =
        provider?.options ??
        (provider?.search && meta.ctx
          ? await provider.search(node.attributes['data-label'], meta.ctx)
          : [])
      const choice = choices.find((option) => String(option.id) === node.id)
      results.set(
        node,
        choice
          ? {
              tagName: 'span',
              attribs: { ...node.attributes, 'data-label': choice.label },
              text: `${provider!.char}${choice.label}`,
            }
          : { tagName: 'span', attribs: {}, text: node.attributes['data-label'] }
      )
    } else if (node.type === 'mergeTag') {
      const tags = definition.mergeTags ?? []
      const known = Array.isArray(tags) ? tags.includes(node.id) : Object.hasOwn(tags, node.id)
      results.set(
        node,
        known
          ? { tagName: 'span', attribs: node.attributes, text: `{{ ${node.id} }}` }
          : { tagName: 'span', attribs: {}, text: `{{ ${node.id} }}` }
      )
    } else {
      const block = definition.customBlocks?.find((candidate) => candidate.id === node.id)
      const index = blockIndex++
      if (!block) {
        results.set(node, null)
        continue
      }
      try {
        const config = await compileValidator(block.schema).validate(
          JSON.parse(node.attributes['data-config']),
          { ctx: meta.ctx, timezone: meta.timezone ?? 'UTC' }
        )
        results.set(node, {
          tagName: 'div',
          attribs: { ...node.attributes, 'data-config': JSON.stringify(config) },
          text: '',
        })
      } catch (error) {
        if (
          !error ||
          typeof error !== 'object' ||
          !('code' in error) ||
          error.code !== 'E_VALIDATION_ERROR' ||
          !('messages' in error) ||
          !Array.isArray(error.messages)
        )
          throw error
        for (const issue of error.messages as { field: string; message: string }[]) {
          const nested = Object.assign(Object.create(Object.getPrototypeOf(field)), field, {
            getFieldPath: () => `${field.getFieldPath()}.blocks.${index}.${issue.field}`,
            wildCardPath: `${field.wildCardPath}.blocks.${index}.${issue.field}`,
          }) as FieldContext
          field.report(issue.message, 'richBlock', nested)
        }
      }
    }
  }
  field.mutate(
    replaceRichNodes(clean, nodes, (_node, index) => {
      const replacement = results.get(nodes[index])
      if (!replacement) return ''
      const attributes = Object.entries(replacement.attribs)
        .map(([key, attribute]) => ` ${key}="${escapeRichText(attribute)}"`)
        .join('')
      return `<${replacement.tagName}${attributes}>${escapeRichText(replacement.text ?? '')}</${replacement.tagName}>`
    }),
    field
  )
}
