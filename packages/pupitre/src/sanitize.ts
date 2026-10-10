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
]
const allowedAttributes: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt'],
}

export type SanitizeHtmlOptions = {
  allow?: {
    tags?: readonly string[]
    attributes?: Record<string, readonly string[]>
  }
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

  return sanitize(html, {
    allowedTags: tags,
    allowedAttributes: attributes,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    nonTextTags: ['script', 'style', 'iframe'],
    exclusiveFilter(frame) {
      return frame.tag === 'script' || frame.tag === 'style' || frame.tag === 'iframe'
    },
  }).replace(/<a\b(?=[^>]*\btarget=(?:"_blank"|'_blank'))([^>]*)>/gi, (_match, attrs: string) => {
    const cleanAttrs = attrs.replace(/\srel=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    return `<a${cleanAttrs} rel="noopener noreferrer">`
  })
}
