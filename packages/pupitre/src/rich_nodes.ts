export type RichNode = { type: string; id: string; attributes: Record<string, string> }
/** Replaces complete atomic nodes, including untrusted children, after normalization.
 * The scanner only sees sanitizer-generated HTML: attribute angle brackets are escaped.
 */
export function replaceRichNodes(
  clean: string,
  nodes: readonly RichNode[],
  replace: (node: RichNode, index: number) => string
): string {
  const tags = /<\/?[^>]+>/g
  let output = ''
  let last = 0
  let index = 0
  let skippedTag: string | undefined
  let depth = 0
  for (const match of clean.matchAll(tags)) {
    const token = match[0]
    const opening = /^<(span|div)(?:\s|>)/.exec(token)
    const rich = opening && /\bdata-type="(?:mergeTag|mention|customBlock)"/.test(token)
    if (skippedTag) {
      if (rich) index++
      if (opening?.[1] === skippedTag) depth++
      else if (token === `</${skippedTag}>` && --depth === 0) {
        skippedTag = undefined
        last = match.index + token.length
      }
      continue
    }
    if (!rich) continue
    output += clean.slice(last, match.index)
    output += replace(nodes[index], index)
    index++
    skippedTag = opening[1]
    depth = 1
  }
  return output + clean.slice(last)
}
