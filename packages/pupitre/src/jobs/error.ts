import { captureTranslation } from '../i18n.js'

/** Failed-job rows retain readable text and key/params for reader-locale translation. */
export function storedJobError(
  error: unknown,
  fallback: string,
  existingResult?: string | null
): { error: string; result?: string } {
  const stored = captureTranslation(error instanceof Error ? error.message : fallback)
  let result: Record<string, unknown> = {}
  if (existingResult) {
    const parsed: unknown = JSON.parse(existingResult)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) result = { ...parsed }
  }
  return {
    error: stored.text,
    ...(stored.translation
      ? { result: JSON.stringify({ ...result, _pupitreError: stored.translation }) }
      : {}),
  }
}
