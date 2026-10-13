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
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-4 text-foreground"
    >
      <p>{t('You are signed in as {name}', { name: impersonation.name })}</p>
      <Button variant="outline" onClick={() => visit(impersonation.leaveUrl, { method: 'post' })}>
        {t('Leave')}
      </Button>
    </section>
  )
}
