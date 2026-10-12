import type { ReactNode } from 'react'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Html({ props, children }: RuntimeProps) {
  const content = typeof props.content === 'string' ? props.content : ''
  return (
    <div
      className="min-w-0 text-sm leading-6 text-foreground [&_a]:text-primary-ink [&_a]:underline [&_a]:underline-offset-4 [&_a]:rounded-sm [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-ring [&_p]:my-3 [&_h1]:my-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:my-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:my-3 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_blockquote]:my-4 [&_blockquote]:rounded-lg [&_blockquote]:bg-muted/40 [&_blockquote]:p-4 [&_blockquote]:text-muted-foreground"
      dangerouslySetInnerHTML={content ? { __html: content } : undefined}
    >
      {content ? undefined : children}
    </div>
  )
}
export default Html
