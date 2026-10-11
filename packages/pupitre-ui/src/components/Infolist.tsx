import type { ReactNode } from 'react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'

type Props = Infer<typeof components.Infolist.props>

export function Infolist({ children }: { props: Props; children?: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">{children}</div>
}
