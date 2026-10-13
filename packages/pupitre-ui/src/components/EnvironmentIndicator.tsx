import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'

import { cn, toneSoft, toTone } from '../primitives/index.js'

export function EnvironmentIndicator({
  environment,
}: {
  environment?: PupitrePageProps['pupitre']['environment']
}) {
  if (!environment) return null
  const tone = toTone(environment.color)
  return (
    <>
      <span
        aria-hidden="true"
        data-environment-strip=""
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-50 h-1 border-y border-border',
          toneSoft[tone]
        )}
      />
      <span
        data-environment-indicator=""
        className={cn(
          'max-w-28 truncate border-y border-border px-2 py-1 text-xs font-medium',
          toneSoft[tone]
        )}
      >
        <span className="sr-only">{t('Environment: {label}', { label: environment.label })}</span>
        <span aria-hidden="true">{environment.label}</span>
      </span>
    </>
  )
}
