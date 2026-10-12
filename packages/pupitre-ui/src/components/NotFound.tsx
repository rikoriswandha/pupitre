import { buttonClasses } from '../primitives/index.js'

export type NotFoundProps = { title: string; message: string }

export function NotFound({ title, message }: NotFoundProps) {
  return (
    <main className="grid min-h-[60vh] place-items-center bg-background px-6 text-center text-foreground">
      <div className="max-w-md">
        <p
          aria-hidden="true"
          className="mb-5 text-8xl font-semibold tracking-tight tabular-nums text-subtle-foreground"
        >
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{message}</p>
        <a href="/" className={buttonClasses({ color: 'primary', className: 'mt-6' })}>
          Return home
        </a>
      </div>
    </main>
  )
}
