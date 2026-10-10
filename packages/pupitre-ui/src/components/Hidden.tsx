import type { ReactNode } from 'react'
import { useBoundValue } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'

type Props = Infer<typeof components.Hidden.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Hidden({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(props.value ?? '', bindings?.value)
  return (
    <input
      type="hidden"
      name={props.name}
      value={
        typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value ?? '')
      }
      onChange={(event) => setValue(event.currentTarget.value)}
      {...props.extraAttributes}
    />
  )
}
export default Hidden
