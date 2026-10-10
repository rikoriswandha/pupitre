import { CircleHelp } from 'lucide-react'

export type NotFoundProps = { title: string; message: string }

export function NotFound({ title, message }: NotFoundProps) {
  return (
    <main className="grid min-h-[60vh] place-items-center bg-background px-6 text-center text-foreground">
      <div className="max-w-md">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <CircleHelp aria-hidden="true" className="size-7" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{message}</p>
        <a
          href="/"
          className="mt-6 inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Return home
        </a>
      </div>
    </main>
  )
}
