import type { ReactNode } from 'react'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Html({ props, children }: RuntimeProps) {
  const content = typeof props.content === 'string' ? props.content : ''
  return (
    <div
      className="min-w-0 text-sm [&_a]:text-primary [&_a]:underline [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={content ? { __html: content } : undefined}
    >
      {content ? undefined : children}
    </div>
  )
}
export default Html
