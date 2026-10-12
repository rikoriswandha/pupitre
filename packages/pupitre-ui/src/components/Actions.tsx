import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { ActionList } from './ActionList.js'

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
  return (
    <ActionList
      actions={actions}
      align={props.alignment === 'center' ? 'center' : props.alignment === 'end' ? 'end' : 'start'}
    />
  )
}
export default Actions
