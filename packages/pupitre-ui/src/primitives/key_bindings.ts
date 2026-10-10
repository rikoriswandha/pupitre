/**
 * Matches a keyboard event against a binding like `mod+s`, `ctrl+shift+k` or
 * `escape`. `mod` is Cmd on macOS and Ctrl elsewhere (either modifier counts).
 */
export function matchesKeyBinding(event: KeyboardEvent, binding: string): boolean {
  const parts = binding
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
  const key = parts.at(-1)
  if (key !== event.key.toLowerCase()) {
    return false
  }
  return parts.slice(0, -1).every((modifier) => {
    switch (modifier) {
      case 'mod':
        return event.metaKey || event.ctrlKey
      case 'ctrl':
        return event.ctrlKey
      case 'meta':
        return event.metaKey
      case 'alt':
        return event.altKey
      case 'shift':
        return event.shiftKey
      default:
        return false
    }
  })
}
