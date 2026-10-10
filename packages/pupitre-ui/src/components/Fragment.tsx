import { Fragment as ReactFragment, type ReactNode } from 'react'
export function Fragment({ children }: { props?: Record<string, unknown>; children?: ReactNode }) {
  return <ReactFragment>{children}</ReactFragment>
}
export default Fragment
