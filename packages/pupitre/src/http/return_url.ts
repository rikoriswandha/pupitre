import type { HttpContext } from '@adonisjs/core/http'

/**
 * Same-origin path check for client-supplied return URLs. Rejects protocol-relative
 * forms, including `/\host`, which WHATWG URL parsing treats as `//host`, and control
 * characters that browsers strip before resolving the URL.
 */
export function isLocalPath(url: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^\/(?![/\\])/.test(url) && !/[\u0000-\u001f\u007f]/.test(url)
}

/** The page the client reported via `X-Pupitre-Url`, if it is a same-origin path. */
export function requestedPageUrl(ctx: HttpContext): string | undefined {
  const url = ctx.request.header('x-pupitre-url')
  return url && isLocalPath(url) ? url : undefined
}

export function currentPageUrl(ctx: HttpContext, fallback: string): string {
  return requestedPageUrl(ctx) ?? fallback
}
