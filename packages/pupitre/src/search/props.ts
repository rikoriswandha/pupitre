import type { HttpContext } from '@adonisjs/core/http'
import type { PupitrePageProps } from '../../catalog/wire.js'

/** `pupitre.panel.search` shared prop; `undefined` hides global search. */
export function searchProps(ctx: HttpContext): PupitrePageProps['pupitre']['panel']['search'] {
  const panel = ctx.pupitre.panel
  if (
    !panel.globalSearch ||
    !panel.resources.some((resource) => resource.definition.globallySearchable?.length)
  ) {
    return undefined
  }
  return {
    url: `${panel.path.replace(/\/$/, '')}/_pupitre/search`,
    keyBinding: panel.globalSearch.keyBinding,
  }
}
