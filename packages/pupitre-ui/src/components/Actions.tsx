import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { ActionButton } from './ActionButton.js'

type RuntimeProps = { props: Record<string, unknown> }
export function Actions({ props }: RuntimeProps) {
  const actions = Array.isArray(props.actions)
    ? props.actions.filter(
        (action): action is ActionDescriptor =>
          !!action &&
          typeof action === 'object' &&
          'name' in action &&
          'label' in action &&
          typeof action.name === 'string' &&
          typeof action.label === 'string'
      )
    : []
  const alignment =
    props.alignment === 'center'
      ? 'justify-center'
      : props.alignment === 'end'
        ? 'justify-end'
        : 'justify-start'
  return (
    <div className={`flex flex-wrap gap-2 ${alignment}`}>
      {actions.map((action) => (
        <ActionButton key={action.name} action={action} />
      ))}
    </div>
  )
}
export default Actions
