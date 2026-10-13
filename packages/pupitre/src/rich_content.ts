import { sanitizeHtml } from './sanitize.js'
import type { RichContentOptions, RichBlockDefinition } from './definition/rich_content.js'
import { replaceRichNodes } from './rich_nodes.js'
import type { RichNode } from './rich_nodes.js'

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeRichText(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => htmlEscapes[char])
}
export function richBlockDefinitions(
  blocks: RichContentOptions['blocks'] = []
): RichBlockDefinition[] {
  return blocks.map((block) => ('toDefinition' in block ? block.toDefinition() : block))
}
/** Sanitizes stored editor HTML, resolves merge tags, and drops unknown custom blocks.
 * Block renderers produce escaped text by default; `.rawHtml()` opts into sanitized HTML.
 */
export function renderRichContent(html: string, options: RichContentOptions = {}): string {
  const blocks = richBlockDefinitions(options.blocks)
  const nodes: RichNode[] = []
  const clean = sanitizeHtml(html, {
    richNode: (node) => {
      nodes.push(node)
    },
  })
  return replaceRichNodes(clean, nodes, (node) => {
    if (node.type === 'mention') {
      return `<span data-type="mention" data-id="${escapeRichText(node.id)}" data-label="${escapeRichText(node.attributes['data-label'])}" data-char="${escapeRichText(node.attributes['data-char'])}">${escapeRichText(node.attributes['data-char'] + node.attributes['data-label'])}</span>`
    }
    if (node.type === 'mergeTag')
      return escapeRichText(
        Object.hasOwn(options.mergeTags ?? {}, node.id)
          ? options.mergeTags![node.id]
          : `{{ ${node.id} }}`
      )
    const block = blocks.find((candidate) => candidate.id === node.id)
    if (!block?.toHtml) return ''
    const config = JSON.parse(node.attributes['data-config']) as Record<string, unknown>
    const output = block.toHtml({ config })
    return block.rawHtml ? sanitizeHtml(output) : escapeRichText(output)
  })
}
