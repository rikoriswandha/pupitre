import { MediaEntry } from './MediaEntry.js'
import type { MediaEntryProps } from './MediaEntry.js'
export function MediaColumn(props: MediaEntryProps) {
  return <MediaEntry {...props} linked={false} />
}
