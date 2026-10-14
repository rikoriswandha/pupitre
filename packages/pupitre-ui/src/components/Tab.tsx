import { useContext, type ReactNode } from 'react'
import { TabContext } from './Tabs.js'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Tab({ props, children }: RuntimeProps) {
  const context = useContext(TabContext)
  const key = typeof props.key === 'string' ? props.key : ''
  const label = typeof props.label === 'string' ? props.label : key
  if (!context)
    return (
      <section aria-label={label} className="space-y-3">
        {children}
      </section>
    )
  const selected = context.active === key
  return (
    <section
      data-pupitre-tab-panel=""
      role="tabpanel"
      id={`${context.id}-${key}-panel`}
      aria-labelledby={`${context.id}-${key}-tab`}
      hidden={!selected}
      tabIndex={0}
      className="min-w-0 space-y-5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      {children}
    </section>
  )
}
export default Tab
