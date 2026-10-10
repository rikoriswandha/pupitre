export type AnyClosure = (...args: never[]) => unknown
export type Serializable = unknown
export type DefinitionValue =
  | string
  | number
  | boolean
  | null
  | AnyClosure
  | DefinitionValue[]
  | { [key: string]: DefinitionValue }

export function stableJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (typeof input === 'function') return `fn:${hash(input.toString())}`
    if (Array.isArray(input)) return input.map(normalize)
    if (input && typeof input === 'object') {
      const object = input as Record<string, unknown>
      return Object.fromEntries(
        Object.keys(object)
          .sort()
          .map((key) => [key, normalize(object[key])])
      )
    }
    return input
  }
  return JSON.stringify(normalize(value), null, 2)
}

export function hash(source: string): string {
  let h1 = 0x811c9dc5
  for (let i = 0; i < source.length; i++) {
    h1 ^= source.charCodeAt(i)
    h1 = Math.imul(h1, 0x01000193)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0')
}

export function kebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export function pluralize(value: string): string {
  if (/(s|x|z|ch|sh)$/i.test(value)) return `${value}es`
  if (/[^aeiou]y$/i.test(value)) return `${value.slice(0, -1)}ies`
  return `${value}s`
}
