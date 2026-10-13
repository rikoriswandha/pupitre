import { t, useVisit } from '@rikology/pupitre-react'
import { Button } from '../primitives/index.js'

export function ImpersonationBanner({
  impersonation,
}: {
  impersonation?: { name: string; leaveUrl: string }
}) {
  const visit = useVisit()
  if (!impersonation) return null
  return (
    <section
      aria-label={t('Impersonation')}
      className="mb-6 flex w-full flex-wrap items-center justify-between gap-3 border-y border-border bg-warning-soft px-4 py-3 text-warning-ink"
    >
      <p>{t('You are signed in as {name}', { name: impersonation.name })}</p>
      <Button variant="outline" onClick={() => visit(impersonation.leaveUrl, { method: 'post' })}>
        {t('Leave')}
      </Button>
    </section>
  )
}
