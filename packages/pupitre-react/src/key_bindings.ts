/** Matches shortcuts such as `mod+s`; mod accepts Cmd or Ctrl on any platform. */
export function matchesKeyBinding(event: KeyboardEvent, binding: string): boolean {
  const parts = binding
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
  if (parts.at(-1) !== event.key.toLowerCase()) return false
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
