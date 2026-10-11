import { useContext, type ReactNode } from 'react'
import { WizardContext } from './Wizard.js'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Step({ props, children }: RuntimeProps) {
  const wizard = useContext(WizardContext)
  const key = typeof props.key === 'string' ? props.key : ''
  const selected = !wizard || wizard.keys.indexOf(key) === wizard.active
  return (
    <section
      role="group"
      aria-label={typeof props.label === 'string' ? props.label : undefined}
      hidden={!selected}
      data-wizard-step={key}
    >
      {children}
    </section>
  )
}
export default Step
