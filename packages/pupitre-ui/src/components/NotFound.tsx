import { t } from '@rikology/pupitre-react'
import { buttonClasses, ledgerRuleClasses } from '../primitives/index.js'

export type NotFoundProps = { title: string; message: string }

export function NotFound({ title, message }: NotFoundProps) {
  return (
    <main className="grid min-h-[60vh] place-items-center bg-background px-6 text-center text-foreground">
      <div className={`w-full max-w-md ${ledgerRuleClasses} py-8`}>
        <p
          aria-hidden="true"
          className="mb-5 text-8xl font-semibold tracking-tight tabular-nums text-subtle-foreground"
        >
          404
        </p>
        <h1
          data-pupitre-page-title=""
          className="font-display text-[1.875rem] font-normal leading-9 tracking-[-0.01em]"
        >
          {title}
        </h1>
        <p className="mt-2 text-muted-foreground">{message}</p>
        <a href="/" className={buttonClasses({ color: 'primary', className: 'mt-6' })}>
          {t('Return home')}
        </a>
      </div>
    </main>
  )
}
