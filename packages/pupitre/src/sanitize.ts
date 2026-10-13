import sanitize from 'sanitize-html'

const allowedTags = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h2',
  'h3',
  'pre',
  'code',
  'img',
  'hr',
  'span',
  'div',
]
const allowedAttributes: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt'],
  span: ['data-type', 'data-id', 'data-label', 'data-char'],
  div: ['data-type', 'data-id', 'data-config'],
}

export type SanitizeHtmlOptions = {
  allow?: {
    tags?: readonly string[]
    attributes?: Record<string, readonly string[]>
  }
  /** Internal visitor observes only normalized, structurally valid rich nodes. */
  richNode?: (node: { type: string; id: string; attributes: Record<string, string> }) => void
  invalidBlock?: () => void
}

/** Sanitize rich text to the Pupitre editor's safe HTML allowlist. */
export function sanitizeHtml(html: string, options: SanitizeHtmlOptions = {}): string {
  const tags = options.allow?.tags
    ? [...new Set([...allowedTags, ...options.allow.tags])]
    : allowedTags
  const attributes = { ...allowedAttributes }
  for (const [tag, attrs] of Object.entries(options.allow?.attributes ?? {})) {
    attributes[tag] = [...new Set([...(attributes[tag] ?? []), ...attrs])]
  }
  const transformRichTag = (tagName: string, attribs: Record<string, string>) => {
    const type = attribs['data-type']
    const id = attribs['data-id']
    const richAttributes: Record<string, string> = {}
    if (tagName === 'span' && type === 'mergeTag' && id && /^[\w.-]{1,128}$/.test(id)) {
      Object.assign(richAttributes, { 'data-type': type, 'data-id': id })
    } else if (
      tagName === 'span' &&
      type === 'mention' &&
      id &&
      id.length <= 128 &&
      attribs['data-char'] &&
      !/\s/.test(attribs['data-char']) &&
      attribs['data-char'].length <= 8
    ) {
      Object.assign(richAttributes, {
        'data-type': type,
        'data-id': id,
        'data-label': (attribs['data-label'] ?? id).slice(0, 512),
        'data-char': attribs['data-char'],
      })
    } else if (tagName === 'div' && type === 'customBlock' && id && /^[\w-]{1,128}$/.test(id)) {
      try {
        const raw = attribs['data-config'] ?? '{}'
        const config: unknown = raw.length <= 65536 ? JSON.parse(raw) : null
        if (
          config &&
          typeof config === 'object' &&
          !Array.isArray(config) &&
          !Object.keys(config).some((key) =>
            ['__proto__', 'constructor', 'prototype'].includes(key)
          )
        ) {
          Object.assign(richAttributes, {
            'data-type': type,
            'data-id': id,
            'data-config': JSON.stringify(config),
          })
        }
      } catch {
        /* Invalid JSON is not a rich-content node. */
      }
    }
    if (type === 'customBlock' && !richAttributes['data-type']) options.invalidBlock?.()
    if (richAttributes['data-type']) {
      options.richNode?.({ type, id, attributes: richAttributes })
      return { tagName, attribs: richAttributes }
    }
    const clean = { ...attribs }
    for (const key of Object.keys(clean)) if (key.startsWith('data-')) delete clean[key]
    return { tagName, attribs: clean }
  }

  return sanitize(html, {
    allowedTags: tags,
    allowedAttributes: attributes,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    nonTextTags: ['script', 'style', 'iframe'],
    transformTags: { span: transformRichTag, div: transformRichTag },
    exclusiveFilter(frame) {
      return frame.tag === 'script' || frame.tag === 'style' || frame.tag === 'iframe'
    },
  }).replace(/<a\b(?=[^>]*\btarget=(?:"_blank"|'_blank'))([^>]*)>/gi, (_match, attrs: string) => {
    const cleanAttrs = attrs.replace(/\srel=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    return `<a${cleanAttrs} rel="noopener noreferrer">`
  })
}
